const express = require("express");
const router = express.Router();
const dashboardController = require("../../controllers/dashboardController");
const Intl = require("intl");

router.get("/", function (req, res) {
  res.redirect("/dashboard");
})

router.get("/dashboard", dashboardController.getDashboard);

function formatCurrency(value, currency, languageCode = "en-US") {
  return new Intl.NumberFormat(languageCode, {
    style: "currency",
    currency: currency,
  }).format(value);
};
router.get("/test", function (req, res) {
  const data = {
    order: {
      id: 1234,
      customerId: 1,
      node: null,
      deliveryAddress: "Elmina Lakeside Mall, GF77 & GF78, Ground Floor, 5 & No 7, Persiaran Garcinia, Seksyen U15, 40170 Shah Alam, Selangor",
      deliveryDate: new Date().toDateString(),
      deliveryTime: new Date().toLocaleTimeString(),
      storeLocation: "George Town",
      deliveryMethod: "",
      createdAt: "2025-04-14T12:24:10.243Z",
      orderId: 1234,
    },
    customer: {
      id: 1,
      email: "john@example.com",
      firstName: "John",
      lastName: "Smith",
      phone: null,
    },
    items: [
      {
        id: 866550311766439000,
        admin_graphql_api_id: "gid://shopify/LineItem/866550311766439020",
        attributed_staffs: [
          { id: "gid://shopify/StaffMember/902541635", quantity: 1 },
        ],
        current_quantity: 1,
        fulfillable_quantity: 1,
        fulfillment_service: "manual",
        fulfillment_status: null,
        gift_card: false,
        grams: 30,
        name: "T-Shirts",
        price: "539.00",
        price_set: {
          shop_money: { amount: "539.00", currency_code: "INR" },
          presentment_money: { amount: "539.00", currency_code: "INR" },
        },
        product_exists: true,
        product_id: 8455350976769,
        properties: [],
        quantity: 1,
        requires_shipping: true,
        sales_line_item_group_id: null,
        sku: "00001",
        taxable: true,
        title: "T-Shirts",
        total_discount: "0.00",
        total_discount_set: {
          shop_money: { amount: "0.00", currency_code: "INR" },
          presentment_money: { amount: "0.00", currency_code: "INR" },
        },
        variant_id: 45196809634049,
        variant_inventory_management: "shopify",
        variant_title: null,
        vendor: null,
        tax_lines: [],
        duties: [],
        discount_allocations: [],
        category: "Uncategorized",
      },
      {
        id: 141249953214522980,
        admin_graphql_api_id: "gid://shopify/LineItem/141249953214522974",
        attributed_staffs: [],
        current_quantity: 1,
        fulfillable_quantity: 1,
        fulfillment_service: "manual",
        fulfillment_status: null,
        gift_card: false,
        grams: 0,
        name: "Third product",
        price: "1000.00",
        price_set: {
          shop_money: { amount: "1000.00", currency_code: "INR" },
          presentment_money: { amount: "1000.00", currency_code: "INR" },
        },
        product_exists: true,
        product_id: 8503763403009,
        properties: [],
        quantity: 1,
        requires_shipping: true,
        sales_line_item_group_id: 142831562,
        sku: "010101010101",
        taxable: true,
        title: "Third product",
        total_discount: "0.00",
        total_discount_set: {
          shop_money: { amount: "0.00", currency_code: "INR" },
          presentment_money: { amount: "0.00", currency_code: "INR" },
        },
        variant_id: 45317564563713,
        variant_inventory_management: "shopify",
        variant_title: null,
        vendor: null,
        tax_lines: [],
        duties: [],
        discount_allocations: [],
        category: "Uncategorized",
      },
      {
        id: 257004973105704600,
        admin_graphql_api_id: "gid://shopify/LineItem/257004973105704598",
        attributed_staffs: [],
        current_quantity: 1,
        fulfillable_quantity: 1,
        fulfillment_service: "manual",
        fulfillment_status: null,
        gift_card: false,
        grams: 0,
        name: "Classic T-Shirt",
        price: "500.00",
        price_set: {
          shop_money: { amount: "500.00", currency_code: "INR" },
          presentment_money: { amount: "500.00", currency_code: "INR" },
        },
        product_exists: true,
        product_id: 8665557565697,
        properties: [],
        quantity: 1,
        requires_shipping: true,
        sales_line_item_group_id: 142831562,
        sku: "",
        taxable: true,
        title: "Classic T-Shirt",
        total_discount: "0.00",
        total_discount_set: {
          shop_money: { amount: "0.00", currency_code: "INR" },
          presentment_money: { amount: "0.00", currency_code: "INR" },
        },
        variant_id: 45887106744577,
        variant_inventory_management: "shopify",
        variant_title: null,
        vendor: null,
        tax_lines: [],
        duties: [],
        discount_allocations: [],
        category: "Uncategorized",
      },
    ],
    category: "Uncategorized",
    currency: "INR",
    languageCode: "en",
    totalPrice: { amount: "2029.00", currency_code: "INR" },
    formatCurrency,
  };
  res.render("templates/order-template", data);
});

router.get("/pdf/view/:id", dashboardController.viewPdf);
router.get("/pdf/download/:id", dashboardController.downloadPdf);
router.post("/pdf/reprint/:id", dashboardController.reprintPdf);

router.get("/export/csv", dashboardController.exportCsv);

module.exports = router;
