/**
 * Nocodebackend API client with retry logic and error handling
 * 
 * REAL API format (discovered from swagger-ui-init.js):
 *   POST https://api.nocodebackend.com/create/{tableName}?Instance={dbName}
 *   GET  https://api.nocodebackend.com/read/{tableName}?Instance={dbName}
 *   Authorization: Bearer {secretKey}
 * 
 * The baseUrl entered by user can be:
 *   - Full: https://api.nocodebackend.com  → extract base + use /create/ prefix
 *   - With instance: already contains the instance info
 * 
 * The "Instance" parameter (database name) is passed as a query string param.
 */

import { sleep } from './utils.js';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff ms
const RATE_LIMIT_DELAY = 5000;

/**
 * Parse the user-provided baseUrl to extract:
 *  - apiRoot: the root of the API (e.g. https://api.nocodebackend.com)
 *  - instanceName: the database instance name (e.g. 44716_e_commerce_order_import)
 * 
 * Supports formats:
 *  - https://api.nocodebackend.com  (no instance → user must provide it separately)
 *  - https://api.nocodebackend.com/create/customers?Instance=44716_xxx  (extract from URL)
 *  - https://api.nocodebackend.com?Instance=44716_xxx  (query param)
 */
export function parseNcbUrl(rawUrl) {
  try {
    // Remove trailing slash
    const cleaned = rawUrl.trim().replace(/\/$/, '');

    // Try to parse as URL
    let urlObj;
    try {
      urlObj = new URL(cleaned);
    } catch {
      return { apiRoot: cleaned, instanceName: '' };
    }

    // Extract Instance from query params
    const instanceFromQuery = urlObj.searchParams.get('Instance') || '';

    // Get the origin (scheme + host)
    const apiRoot = urlObj.origin; // e.g. https://api.nocodebackend.com

    return { apiRoot, instanceName: instanceFromQuery };
  } catch {
    return { apiRoot: rawUrl, instanceName: '' };
  }
}

/**
 * Make a single API request with retry logic
 */
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  try {
    const response = await fetch(url, options);

    // Rate limiting — pause and retry
    if (response.status === 429) {
      if (retries > 0) {
        await sleep(RATE_LIMIT_DELAY);
        return fetchWithRetry(url, options, retries - 1);
      }
      return { success: false, status: 429, error: 'Rate limit (429) — dépassé après retries', data: null };
    }

    // Server errors — retry with backoff
    if (response.status >= 500 && retries > 0) {
      const retryIndex = MAX_RETRIES - retries;
      await sleep(RETRY_DELAYS[retryIndex] || 4000);
      return fetchWithRetry(url, options, retries - 1);
    }

    // Client errors — don't retry, log and skip
    if (response.status >= 400) {
      let errorBody = '';
      try { errorBody = await response.text(); } catch (e) { /* ignore */ }
      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}: ${errorBody.substring(0, 200)}`,
        data: null,
      };
    }

    // Success (200, 201, etc.)
    let data = null;
    try {
      const text = await response.text();
      if (text) data = JSON.parse(text);
    } catch (e) {
      // Non-JSON response is fine
    }

    return { success: true, status: response.status, data, error: null };

  } catch (err) {
    // Network/fetch error — retry
    if (retries > 0) {
      const retryIndex = MAX_RETRIES - retries;
      await sleep(RETRY_DELAYS[retryIndex] || 4000);
      return fetchWithRetry(url, options, retries - 1);
    }
    return { success: false, status: 0, error: `Erreur réseau: ${err.message}`, data: null };
  }
}

/**
 * Create API client bound to apiRoot, instanceName, and secretKey
 * 
 * @param {string} apiRoot - e.g. "https://api.nocodebackend.com"
 * @param {string} secretKey - Bearer token
 * @param {string} instanceName - e.g. "44716_e_commerce_order_import"
 */
export function createApiClient(apiRoot, secretKey, instanceName = '') {
  const root = apiRoot.replace(/\/$/, '');
  const instance = instanceName;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${secretKey}`,
  };

  /**
   * Build a URL with Instance query param appended
   */
  function buildUrl(path, extraParams = {}) {
    const params = new URLSearchParams();
    if (instance) params.set('Instance', instance);
    for (const [k, v] of Object.entries(extraParams)) {
      params.set(k, v);
    }
    const qs = params.toString();
    return `${root}${path}${qs ? '?' + qs : ''}`;
  }

  /**
   * Test connection — GET /read/{table} to verify API is reachable and auth works
   */
  async function testConnection(tableName = 'customers') {
    const url = buildUrl(`/read/${tableName}`);
    try {
      const response = await fetch(url, { method: 'GET', headers });
      const isOk = response.status < 500;
      let body = '';
      try { body = await response.text(); } catch (e) { /* ignore */ }

      return {
        ok: isOk,
        status: response.status,
        message: isOk
          ? `Connexion réussie (HTTP ${response.status})`
          : `Erreur serveur HTTP ${response.status}: ${body.substring(0, 100)}`,
        url,
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        message: `Erreur réseau: ${err.message}`,
        url,
      };
    }
  }

  /**
   * Insert a single record into a table
   * POST /create/{tableName}?Instance={instance}
   */
  async function insert(tableName, record) {
    const url = buildUrl(`/create/${tableName}`);
    return fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(record),
    });
  }

  /**
   * Get records from a table (for verification)
   * GET /read/{tableName}?Instance={instance}&{filterParams}
   */
  async function getRecords(tableName, filterParams = {}) {
    const url = buildUrl(`/read/${tableName}`, filterParams);
    try {
      const response = await fetch(url, { method: 'GET', headers });
      let data = null;
      try { data = await response.json(); } catch (e) { /* ignore */ }
      return {
        success: response.ok,
        status: response.status,
        data,
        error: null,
      };
    } catch (err) {
      return { success: false, status: 0, data: null, error: err.message };
    }
  }

  return { testConnection, insert, getRecords, buildUrl };
}

/**
 * Legacy compatibility: create client from a raw URL string
 * Tries to auto-detect the format and extract instance name
 */
export function createApiClientFromUrl(rawUrl, secretKey) {
  const { apiRoot, instanceName } = parseNcbUrl(rawUrl);
  return createApiClient(apiRoot, secretKey, instanceName);
}
