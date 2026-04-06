/**
 * Main import orchestration engine
 * Handles: parsing, deduplication, batched API calls, pause/resume, semaphore
 */

import { parseJsonlFile } from './jsonlParser.js';
import { transformOrder } from './dataTransformer.js';
import { upsertCustomer, getCustomerList } from './customerDeduplicator.js';
import { sleep } from './utils.js';

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.current < this.maxConcurrent) {
      this.current++;
      return;
    }
    await new Promise(resolve => this.queue.push(resolve));
    this.current++;
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    }
  }
}

/**
 * Process items in parallel with semaphore control
 * @param {Array} items 
 * @param {Function} processor - async (item, index) => result
 * @param {number} concurrency 
 * @param {number} delay - ms between task starts
 * @param {Object} control - { paused, cancelled }
 * @param {Function} onResult - callback for each result
 */
async function parallelProcess(items, processor, concurrency, delay, control, onResult) {
  const semaphore = new Semaphore(concurrency);
  const promises = [];

  for (let i = 0; i < items.length; i++) {
    if (control.cancelled) break;

    // Wait while paused
    while (control.paused && !control.cancelled) {
      await sleep(200);
    }
    if (control.cancelled) break;

    await semaphore.acquire();

    if (control.cancelled) {
      semaphore.release();
      break;
    }

    const item = items[i];
    const index = i;

    const promise = (async () => {
      try {
        const result = await processor(item, index);
        if (onResult) onResult(result, item, index);
      } finally {
        semaphore.release();
      }
    })();

    promises.push(promise);

    if (delay > 0 && i < items.length - 1) {
      await sleep(delay);
    }
  }

  await Promise.all(promises);
}

/**
 * Create the import engine
 * @param {Object} apiClient - From createApiClient()
 * @param {Object} callbacks - Event callbacks
 * @returns {Object} engine
 */
export function createImportEngine(apiClient, callbacks) {
  const {
    onParseProgress,
    onParseComplete,
    onPhaseStart,
    onPhaseProgress,
    onPhaseComplete,
    onError,
    onLog,
    onComplete,
  } = callbacks;

  const control = { paused: false, cancelled: false };

  // Collected data
  let customerMap = new Map();
  let orders = [];
  let products = [];
  let parseErrors = [];

  /**
   * Phase 1: Parse the entire file
   */
  async function parseFile(file) {
    customerMap = new Map();
    orders = [];
    products = [];
    parseErrors = [];

    let lineCount = 0;

    await parseJsonlFile(
      file,
      (rawOrder, lineNum) => {
        lineCount = lineNum;
        try {
          const { customerData, orderData, productItems } = transformOrder(rawOrder);
          if (customerData.email) {
            upsertCustomer(customerMap, customerData);
          }
          orders.push(orderData);
          products.push(...productItems);
        } catch (e) {
          parseErrors.push({ lineNum, error: e.message });
          if (onError) onError({ phase: 'parse', lineNum, error: e.message });
        }
        if (lineNum % 500 === 0 && onParseProgress) {
          onParseProgress({
            linesProcessed: lineNum,
            customers: customerMap.size,
            orders: orders.length,
            products: products.length,
          });
        }
      },
      (bytesRead, totalBytes) => {
        if (onParseProgress) {
          onParseProgress({
            bytesRead,
            totalBytes,
            linesProcessed: lineCount,
            customers: customerMap.size,
            orders: orders.length,
            products: products.length,
          });
        }
      },
      (err, lineNum, rawLine) => {
        parseErrors.push({ lineNum, error: err.message, rawLine: rawLine?.substring(0, 200) });
        if (onError) onError({ phase: 'parse', lineNum, error: err.message });
      },
      control
    );

    const customerList = getCustomerList(customerMap);

    if (onParseComplete) {
      onParseComplete({
        customers: customerList.length,
        orders: orders.length,
        products: products.length,
        parseErrors: parseErrors.length,
      });
    }

    return { customerList, orders, products };
  }

  /**
   * Insert phase: send records to API
   */
  async function insertPhase(tableName, records, concurrency, delay) {
    if (onPhaseStart) onPhaseStart(tableName, records.length);

    let inserted = 0;
    let failed = 0;
    const errors = [];
    const startTime = Date.now();

    await parallelProcess(
      records,
      async (record) => {
        if (control.cancelled) return null;
        const result = await apiClient.insert(tableName, record);
        return { result, record };
      },
      concurrency,
      delay,
      control,
      ({ result, record }, item, index) => {
        if (!result) return;
        if (result.success) {
          inserted++;
          if (onLog) onLog({
            type: 'success',
            table: tableName,
            id: record.email || record.order_id || record.item_id || index,
            status: result.status,
          });
        } else {
          failed++;
          const errEntry = {
            phase: tableName,
            identifier: record.email || record.order_id || record.item_id || String(index),
            status: result.status,
            error: result.error,
            record,
          };
          errors.push(errEntry);
          if (onError) onError(errEntry);
          if (onLog) onLog({
            type: 'error',
            table: tableName,
            id: errEntry.identifier,
            status: result.status,
            error: result.error,
          });
        }

        if (onPhaseProgress) {
          onPhaseProgress(tableName, {
            done: inserted + failed,
            total: records.length,
            inserted,
            failed,
            elapsed: Date.now() - startTime,
          });
        }
      }
    );

    if (onPhaseComplete) onPhaseComplete(tableName, { inserted, failed, errors });
    return { inserted, failed, errors };
  }

  /**
   * Main run function
   */
  async function run(file, { concurrency = 3, delay = 100, dryRun = false } = {}) {
    control.paused = false;
    control.cancelled = false;

    // Phase 1: Parse
    if (onLog) onLog({ type: 'info', message: 'Démarrage de l\'analyse du fichier...' });
    const { customerList, orders: orderList, products: productList } = await parseFile(file);

    if (control.cancelled) {
      if (onLog) onLog({ type: 'warning', message: 'Import annulé.' });
      return;
    }

    if (dryRun) {
      if (onLog) onLog({ type: 'info', message: 'Mode simulation : aucun appel API effectué.' });
      if (onComplete) onComplete({ dryRun: true, customers: customerList.length, orders: orderList.length, products: productList.length });
      return;
    }

    // Phase 2: Insert customers
    const custResult = await insertPhase('customers', customerList, concurrency, delay);
    if (control.cancelled) return;

    // Phase 3: Insert orders
    const ordResult = await insertPhase('orders', orderList, concurrency, delay);
    if (control.cancelled) return;

    // Phase 4: Insert products
    const prodResult = await insertPhase('customer_products', productList, concurrency, delay);

    if (onComplete) {
      onComplete({
        dryRun: false,
        customers: custResult,
        orders: ordResult,
        products: prodResult,
        totalErrors: [...custResult.errors, ...ordResult.errors, ...prodResult.errors],
      });
    }
  }

  /**
   * Retry failed records
   */
  async function retryFailed(failedErrors, concurrency = 3, delay = 100) {
    const grouped = {};
    for (const err of failedErrors) {
      if (!grouped[err.phase]) grouped[err.phase] = [];
      grouped[err.phase].push(err.record);
    }

    const results = {};
    for (const [tableName, records] of Object.entries(grouped)) {
      results[tableName] = await insertPhase(tableName, records, concurrency, delay);
    }
    return results;
  }

  return {
    run,
    retryFailed,
    pause: () => { control.paused = true; },
    resume: () => { control.paused = false; },
    cancel: () => { control.cancelled = true; control.paused = false; },
    getData: () => ({
      customers: getCustomerList(customerMap),
      orders,
      products,
    }),
  };
}
