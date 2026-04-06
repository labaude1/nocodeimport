/**
 * Utility functions for data transformation
 */

/**
 * Normalize French phone number to international format (33XXXXXXXXX)
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s.\-()]/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '33' + cleaned.substring(1);
  }
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Convert Unix timestamp to ISO date string (YYYY-MM-DD)
 */
export function unixToISO(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

/**
 * Format number with French thousand separators (1 000)
 */
export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('fr-FR').format(num);
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format elapsed time in French (HH:MM:SS)
 */
export function formatDuration(ms) {
  if (!ms || ms < 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }
  if (m > 0) {
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }
  return `${s}s`;
}

/**
 * Estimate remaining time based on progress
 */
export function estimateRemaining(done, total, elapsedMs) {
  if (done <= 0 || total <= 0) return null;
  const rate = done / elapsedMs;
  const remaining = (total - done) / rate;
  return remaining;
}

/**
 * Sleep for N milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a unique ID
 */
export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str, maxLen = 60) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

/**
 * Format a number as currency
 */
export function formatCurrency(amount, currency = 'EUR') {
  if (amount === null || amount === undefined) return '0,00 €';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}

/**
 * Safe JSON parse - returns null on error
 */
export function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

/**
 * Clamp a value between min and max
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Calculate requests per second
 */
export function calcRps(count, elapsedMs) {
  if (elapsedMs <= 0) return 0;
  return (count / (elapsedMs / 1000)).toFixed(1);
}
