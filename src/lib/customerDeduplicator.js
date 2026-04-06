/**
 * Customer deduplication logic using an in-memory Map keyed by email.
 * On duplicate email: merge/update the customer record.
 */

/**
 * Merge a new customer record into the dedup map
 * @param {Map} customerMap - In-memory dedup map (email -> customerData)
 * @param {Object} newCustomer - New customer data from transformOrder
 */
export function upsertCustomer(customerMap, newCustomer) {
  const key = newCustomer.email;
  if (!key) return; // Skip records without email

  if (!customerMap.has(key)) {
    // First occurrence
    customerMap.set(key, { ...newCustomer });
    return;
  }

  // Existing customer — merge
  const existing = customerMap.get(key);

  // Increment totals
  existing.total_orders += 1;
  existing.total_spent = parseFloat((existing.total_spent + newCustomer.total_spent).toFixed(2));

  // Update date range
  if (newCustomer.first_order_date && newCustomer.first_order_date < existing.first_order_date) {
    existing.first_order_date = newCustomer.first_order_date;
  }
  if (newCustomer.last_order_date && newCustomer.last_order_date > existing.last_order_date) {
    existing.last_order_date = newCustomer.last_order_date;
    // Update city/zip from most recent order
    if (newCustomer.city) existing.city = newCustomer.city;
    if (newCustomer.zip_code) existing.zip_code = newCustomer.zip_code;
  }

  // Update phone if current is empty and new one exists
  if (!existing.phone && newCustomer.phone) {
    existing.phone = newCustomer.phone;
  }

  // Update name fields if empty
  if (!existing.first_name && newCustomer.first_name) {
    existing.first_name = newCustomer.first_name;
  }
  if (!existing.last_name && newCustomer.last_name) {
    existing.last_name = newCustomer.last_name;
  }
  if (!existing.title && newCustomer.title) {
    existing.title = newCustomer.title;
  }

  customerMap.set(key, existing);
}

/**
 * Convert the customer map to an array ready for insertion
 * @param {Map} customerMap 
 * @returns {Array}
 */
export function getCustomerList(customerMap) {
  return Array.from(customerMap.values());
}
