const mongoose = require('mongoose');

// Define a Mongoose schema for the webhook payload
const webhookPayloadSchema = new mongoose.Schema({
  charge: {
    address_id: Number,
    analytics_data: {
      utm_params: [String]
    },
    billing_address: {
      address1: String,
      address2: String,
      city: String,
      company: String,
      country: String,
      first_name: String,
      last_name: String,
      phone: String,
      province: String,
      zip: String
    },
    client_details: {
      browser_ip: String,
      user_agent: String
    },
    created_at: Date,
    currency: String,
    customer_hash: String,
    customer_id: Number,
    discount_codes: [
      {
        amount: Number,
        code: String,
        recharge_discount_id: Number,
        type: String
      }
    ],
    email: String,
    first_name: String,
    has_uncommited_changes: Boolean,
    id: Number,
    last_name: String,
    line_items: [
      {
        images: {
          large: String,
          medium: String,
          original: String,
          small: String
        },
        line_item_id: Number,
        original_price: String,
        price: String,
        properties: [Object],
        quantity: Number,
        shopify_product_id: Number,
        shopify_variant_id: Number,
        sku: String,
        subscription_id: Number,
        tax_lines: [Object],
        title: String,
        type: String,
        variant_title: String
      }
    ],
    merged_at: Date,
    note: String,
    note_attributes: [Object],
    processed_at: Date,
    processor_name: String,
    requires_shipping: Boolean,
    scheduled_at: Date,
    shipments_count: Number,
    shipping_address: {
      address1: String,
      address2: String,
      city: String,
      company: String,
      country: String,
      first_name: String,
      last_name: String,
      phone: String,
      province: String,
      zip: String
    },
    shipping_lines: [
      {
        code: String,
        description: String,
        price: String,
        retrieved_at: Date,
        source: String,
        status: String,
        tax_lines: [Object],
        title: String
      }
    ],
    shopify_order_id: String,
    status: String,
    sub_total: String,
    subtotal_price: String,
    tags: String,
    tax_lines: Number,
    total_discounts: Number,
    total_duties: Number,
    total_line_items_price: Number,
    total_price: String,
    total_refunds: String,
    total_tax: Number,
    total_weight: Number,
    transaction_id: String,
    type: String,
    updated_at: Date
  }
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// Create a Mongoose model
const WebhookPayload = mongoose.model('WebhookPayload', webhookPayloadSchema);

module.exports = WebhookPayload;
