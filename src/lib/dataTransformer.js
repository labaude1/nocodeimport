/**
 * Data transformation functions for converting raw JSONL order data
 * into the normalized format for 3 tables: customers, orders, customer_products
 */

import { normalizePhone, unixToISO } from './utils.js';

/**
 * Extract price from order with fallbacks
 */
function extractPrice(order) {
  if (order?.pricing_details?.price !== undefined) {
    return parseFloat(order.pricing_details.price) || 0;
  }
  if (order?.delivery?.pricing_details?.price !== undefined) {
    return parseFloat(order.delivery.pricing_details.price) || 0;
  }
  return 0;
}

/**
 * Extract delivery city from order with fallbacks
 */
function extractDeliveryCity(order) {
  return order?.delivery?.destination?.address?.city
    || order?.pricing_details?.address?.city
    || '';
}

/**
 * Extract delivery zip from order with fallbacks
 */
function extractDeliveryZip(order) {
  return order?.delivery?.destination?.address?.zip_code
    || order?.pricing_details?.address?.zip_code
    || '';
}

/**
 * Resolve item state from line_item_groups
 * Matches by order_item_id === order_items[].id
 */
function resolveItemState(itemId, lineItemGroups) {
  if (!lineItemGroups || !Array.isArray(lineItemGroups)) return 'unknown';
  const match = lineItemGroups.find(g => g.order_item_id === itemId);
  return match?.state || 'unknown';
}

/**
 * Transform a raw order object into structured records for all 3 tables
 * @param {Object} rawOrder - Raw JSON order object
 * @returns {{ customerData, orderData, productItems }}
 */
export function transformOrder(rawOrder) {
  const customer = rawOrder.customer || {};
  const email = (customer.email || '').toLowerCase().trim();
  const orderDate = unixToISO(rawOrder.date);
  const totalPrice = extractPrice(rawOrder);
  const deliveryCity = extractDeliveryCity(rawOrder);
  const deliveryZip = extractDeliveryZip(rawOrder);
  const currency = rawOrder?.pricing_details?.currency || 'EUR';
  const orderItems = rawOrder.order_items || [];
  const lineItemGroups = rawOrder.line_item_groups || [];

  // --- Customer record ---
  const customerData = {
    email,
    first_name: customer.first_name || '',
    last_name: customer.last_name || '',
    phone: normalizePhone(customer.phone_number),
    title: customer.title || '',
    zip_code: deliveryZip,
    city: deliveryCity,
    climate_zone: '',
    total_orders: 1,
    total_spent: totalPrice,
    first_order_date: orderDate,
    last_order_date: orderDate,
    archetype: '',
    expertise_level: '',
    is_subscribed: 1,
  };

  // --- Order record ---
  const orderData = {
    order_id: String(rawOrder.id || ''),
    customer_email: email,
    order_date: orderDate,
    state: rawOrder.state || '',
    order_type: Array.isArray(rawOrder.types) ? (rawOrder.types[0] || '') : '',
    total_price: totalPrice,
    currency,
    delivery_city: deliveryCity,
    delivery_zip: deliveryZip,
    items_count: orderItems.length,
  };

  // --- Product records ---
  const productItems = orderItems.map(item => {
    const features = item?.item?.features || {};
    const nameArr = features.name;
    const imageArr = features.image;

    return {
      order_id: String(rawOrder.id || ''),
      customer_email: email,
      item_id: String(item.item_id || item.id || ''),
      item_name: Array.isArray(nameArr) ? (nameArr[0] || '') : (nameArr || ''),
      item_image: Array.isArray(imageArr) ? (imageArr[0] || '') : (imageArr || ''),
      quantity: parseInt(item.quantity) || 1,
      unit_price: parseFloat(item?.pricing_details?.price) || 0,
      item_state: resolveItemState(item.id, lineItemGroups),
    };
  });

  return { customerData, orderData, productItems };
}
