/**
 * Main import orchestration engine
 * Handles: parsing, deduplication, batched API calls, pause/resume, semaphore
 * 
 * RATE LIMIT AWARE:
 * - Nocodebackend Tier 1: 20 req/10s = 2 req/sec max
 * - Tier 2+: No limits
 * - Auto-throttles on 429 errors
 * - Skips duplicates to avoid re-inserting existing records
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
  
  // Rate limit tracking
  let rateLimitHits = 0;
  let consecutiveRateLimits = 0;

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
   * Check if a customer already exists (to avoid duplicates)
   * Uses email filter to query the API
   */
  async function checkCustomerExists(email) {
    try {
      // Query by email with exact match
      const result = await apiClient.getRecords('customers', { 'email': email });
      if (result.success && result.data) {
        const data = Array.isArray(result.data) ? result.data : (result.data.data || []);
        const exists = data.length > 0;
        if (exists && onLog) {
          onLog({
            type: 'info',
            message: `Client ${email} déjà présent, ignoré`
          });
        }
        return exists;
      }
      return false;
    } catch (e) {
      // If check fails, log but continue (will try insert)
      if (onLog) onLog({
        type: 'warning',
        message: `Impossible de vérifier ${email}: ${e.message}`
      });
      return false;
    }
  }

  /**
   * Batch check for existing customers (more efficient for resume mode)
   * Returns Set of existing emails
   */
  async function checkExistingCustomers(emails, batchSize = 10) {
    const existingEmails = new Set();
    
    if (onLog) onLog({
      type: 'info',
      message: `Vérification de ${emails.length} clients existants...`
    });

    // Check in batches to avoid overwhelming API
    for (let i = 0; i < emails.length; i += batchSize) {
      if (control.cancelled) break;
      
      const batch = emails.slice(i, i + batchSize);
      const checks = await Promise.all(
        batch.map(async email => {
          const exists = await checkCustomerExists(email);
          return { email, exists };
        })
      );

      checks.forEach(({ email, exists }) => {
        if (exists) existingEmails.add(email);
      });

      // Respect rate limits during batch check
      if (i + batchSize < emails.length) {
        await sleep(500); // 10 emails/5s = 2 req/sec
      }

      if (onLog && (i + batchSize) % 100 === 0) {
        onLog({
          type: 'info',
          message: `Vérification: ${Math.min(i + batchSize, emails.length)}/${emails.length} (${existingEmails.size} doublons détectés)`
        });
      }
    }

    if (onLog) onLog({
      type: 'success',
      message: `Vérification terminée: ${existingEmails.size} clients déjà présents sur ${emails.length}`
    });

    return existingEmails;
  }

  /**
   * Insert phase: send records to API with duplicate detection
   */
  async function insertPhase(tableName, records, concurrency, delay, skipDuplicates = true) {
    if (onPhaseStart) onPhaseStart(tableName, records.length);

    let inserted = 0;
    let failed = 0;
    let skipped = 0;
    const errors = [];
    const startTime = Date.now();
    
    // Adaptive delay based on rate limit hits
    let adaptiveDelay = delay;
    
    // For resume mode: batch check existing customers first
    let existingEmails = new Set();
    if (tableName === 'customers' && skipDuplicates && records.length > 0) {
      const emails = records.map(r => r.email).filter(Boolean);
      existingEmails = await checkExistingCustomers(emails);
      
      // Filter out existing customers
      const originalCount = records.length;
      records = records.filter(r => !existingEmails.has(r.email));
      const filteredCount = originalCount - records.length;
      
      if (filteredCount > 0) {
        skipped = filteredCount;
        if (onLog) onLog({
          type: 'info',
          message: `${filteredCount} clients déjà présents filtrés, ${records.length} restants à insérer`
        });
      }
    }

    await parallelProcess(
      records,
      async (record) => {
        if (control.cancelled) return null;
        
        // For customers table, check for duplicates (real-time check as safety net)
        // Note: batch check already filtered most, this is for safety
        if (tableName === 'customers' && skipDuplicates && record.email) {
          // Already checked in batch, but double-check for safety
          if (existingEmails.has(record.email)) {
            return { result: { success: true, status: 200, skipped: true }, record };
          }
        }
        
        const result = await apiClient.insert(tableName, record);
        
        // If insert returned duplicate error, mark as skipped
        if (!result.success && result.error && result.error.toLowerCase().includes('unique')) {
          return { result: { success: true, status: 200, skipped: true }, record };
        }
        
        // Track 429 errors for adaptive throttling
        if (result.status === 429) {
          consecutiveRateLimits++;
          rateLimitHits++;
          // Increase delay exponentially on consecutive 429s
          if (consecutiveRateLimits > 2) {
            adaptiveDelay = Math.min(adaptiveDelay * 1.5, 5000);
            if (onLog) onLog({
              type: 'warning',
              message: `429 détectés : augmentation délai à ${Math.round(adaptiveDelay)}ms`
            });
            await sleep(5000); // Extra pause
          }
        } else if (result.success) {
          consecutiveRateLimits = 0; // Reset on success
        }
        
        return { result, record };
      },
      concurrency,
      delay,
      control,
      ({ result, record }, item, index) => {
        if (!result) return;
        if (result.success) {
          if (result.skipped) {
            skipped++;
            if (onLog && skipped % 100 === 1) onLog({
              type: 'info',
              message: `${skipped} enregistrements ignorés (déjà présents)`,
            });
            if (onPhaseProgress) {
              onPhaseProgress(tableName, {
                done: inserted + failed + skipped,
                total: records.length,
                inserted,
                failed,
                skipped,
                elapsed: Date.now() - startTime,
              });
            }
            return;
          }
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

    if (onPhaseComplete) onPhaseComplete(tableName, { inserted, failed, skipped, errors });
    
    // Log summary
    if (onLog) onLog({
      type: 'info',
      message: `${tableName} : ${inserted} insérés, ${skipped} ignorés (doublons), ${failed} échecs, ${rateLimitHits} rate limits`
    });
    return { inserted, failed, errors };
  }

  /**
   * Main run function
   */
  async function run(file, { concurrency = 1, delay = 500, dryRun = false, skipDuplicates = true } = {}) {
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
    const custResult = await insertPhase('customers', customerList, concurrency, delay, skipDuplicates);
    if (control.cancelled) return;

    // Phase 3: Insert orders
    const ordResult = await insertPhase('orders', orderList, concurrency, delay, false);
    if (control.cancelled) return;

    // Phase 4: Insert products
    const prodResult = await insertPhase('customer_products', productList, concurrency, delay, false);

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
  async function retryFailed(failedErrors, concurrency = 1, delay = 500) {
    const grouped = {};
    for (const err of failedErrors) {
      if (!grouped[err.phase]) grouped[err.phase] = [];
      grouped[err.phase].push(err.record);
    }

    const results = {};
    for (const [tableName, records] of Object.entries(grouped)) {
      // For customers, skip duplicates during retry
      const skipDups = (tableName === 'customers');
      results[tableName] = await insertPhase(tableName, records, concurrency, delay, skipDups);
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
