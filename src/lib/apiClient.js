/**
 * Nocodebackend API client with retry logic and error handling
 */

import { sleep } from './utils.js';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff
const RATE_LIMIT_DELAY = 5000;

/**
 * Make a single API request with retry logic
 * @param {string} url - Full URL
 * @param {Object} options - Fetch options
 * @param {number} retries - Remaining retries
 * @returns {Promise<{ success, data, status, error }>}
 */
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  try {
    const response = await fetch(url, options);

    // Rate limiting
    if (response.status === 429) {
      if (retries > 0) {
        await sleep(RATE_LIMIT_DELAY);
        return fetchWithRetry(url, options, retries - 1);
      }
      return { success: false, status: 429, error: 'Rate limit exceeded after retries', data: null };
    }

    // Server errors — retry
    if (response.status >= 500 && retries > 0) {
      const retryIndex = MAX_RETRIES - retries;
      await sleep(RETRY_DELAYS[retryIndex] || 4000);
      return fetchWithRetry(url, options, retries - 1);
    }

    // Client errors — don't retry
    if (response.status >= 400) {
      let errorBody = '';
      try { errorBody = await response.text(); } catch(e) {}
      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}: ${errorBody}`,
        data: null,
      };
    }

    // Success
    let data = null;
    try {
      const text = await response.text();
      if (text) data = JSON.parse(text);
    } catch(e) {
      // Non-JSON response is ok
    }

    return { success: true, status: response.status, data, error: null };

  } catch (err) {
    // Network error — retry
    if (retries > 0) {
      const retryIndex = MAX_RETRIES - retries;
      await sleep(RETRY_DELAYS[retryIndex] || 4000);
      return fetchWithRetry(url, options, retries - 1);
    }
    return { success: false, status: 0, error: err.message, data: null };
  }
}

/**
 * Create API client bound to a base URL and secret key
 */
export function createApiClient(baseUrl, secretKey) {
  const cleanBase = baseUrl.replace(/\/$/, '');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${secretKey}`,
  };

  /**
   * Test connection — GET to base URL or a known table
   */
  async function testConnection(tableName = '') {
    const url = tableName ? `${cleanBase}/${tableName}` : cleanBase;
    try {
      const response = await fetch(url, { method: 'GET', headers });
      return {
        ok: response.status < 500,
        status: response.status,
        message: response.status < 500 ? 'Connexion réussie' : `Erreur HTTP ${response.status}`,
      };
    } catch (err) {
      return { ok: false, status: 0, message: `Erreur réseau: ${err.message}` };
    }
  }

  /**
   * Insert a single record into a table
   * @param {string} tableName 
   * @param {Object} record 
   * @returns {Promise<{ success, status, error, data }>}
   */
  async function insert(tableName, record) {
    const url = `${cleanBase}/${tableName}`;
    return fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(record),
    });
  }

  /**
   * Get records from a table (for verification)
   * @param {string} tableName 
   * @param {Object} params - Query params
   * @returns {Promise<{ success, status, data, error }>}
   */
  async function getRecords(tableName, params = {}) {
    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const url = `${cleanBase}/${tableName}${queryString ? '?' + queryString : ''}`;
    try {
      const response = await fetch(url, { method: 'GET', headers });
      let data = null;
      try { data = await response.json(); } catch(e) {}
      return { success: response.ok, status: response.status, data, error: null };
    } catch (err) {
      return { success: false, status: 0, data: null, error: err.message };
    }
  }

  return { testConnection, insert, getRecords };
}
