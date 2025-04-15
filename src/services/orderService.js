const path = require("path");
const fs = require("fs");
const ejs = require("ejs");
const WebSocket = require("ws");
const printer = require("pdf-to-printer");
const puppeteer = require("puppeteer");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const socket = new WebSocket(
  "wss://shopify-server-production-3541.up.railway.app"
);

let isProcessing = false;
const pendingOrders = [];

function enqueueOrder(order) {
  pendingOrders.push(order);
  processQueue();
}

function formatCurrency(value, currency, languageCode = "en-US") {
  return new Intl.NumberFormat(languageCode, {
    style: "currency",
    currency: currency,
  }).format(value);
}

async function generatePdfFromHtml(html, outputPath) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  await page.setContent(html, {
    waitUntil: "networkidle0",
  });

  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "0.5cm",
      right: "0.5cm",
      bottom: "0.5cm",
      left: "0.5cm",
    },
  });

  await browser.close();
  return outputPath;
}

async function processQueue() {
  if (isProcessing || pendingOrders.length === 0) return;

  isProcessing = true;
  const order = pendingOrders.shift();

  try {
    const customer = await prisma.customer.upsert({
      where: { email: order.customer.email },
      update: {
        firstName: order.customer.first_name,
        lastName: order.customer.last_name,
        phone: order.customer.phone,
      },
      create: {
        email: order.customer.email,
        firstName: order.customer.first_name,
        lastName: order.customer.last_name,
        phone: order.customer.phone,
      },
    });

    const groupedItems = {};
    order.lineItem.forEach((item) => {
      const category =
        item.properties?.find((p) => p.name === "Category")?.value ||
        "Uncategorized";
      if (!groupedItems[category]) groupedItems[category] = [];
      groupedItems[category].push(item);
    });

    const orderDir = path.join(
      __dirname,
      "../../order-pdf",
      String(order.orderId)
    );
    if (!fs.existsSync(orderDir)) fs.mkdirSync(orderDir, { recursive: true });

    const currency = order.currency;
    const languageCode = order.languageCode;
    const totalPrice = order.totalPrice;

    const deliveryTime = order.deliveryTime || new Date().toLocaleTimeString();
    const deliveryAddress = order.deliveryAddress || "Not specified";
    const storeLocation = order.storeLocation || "Not specified";
    const deliveryMethod = order.deliveryMethod || "Not specified";

    // Create order record first
    const createdOrder = await prisma.order.create({
      data: {
        id: order.orderId,
        customerId: customer.id,
        deliveryAddress: deliveryAddress,
        deliveryDate: order.deliveryDate || new Date().toDateString(),
        deliveryTime: deliveryTime,
        storeLocation: storeLocation,
        deliveryMethod: deliveryMethod,
        node: order.node || null,
        customAttributes: order.customAttributes || {},
      },
    });

    // Load the EJS template
    const templatePath = path.join(
      __dirname,
      "../views",
      "templates",
      "order-template.ejs"
    );
    const template = fs.readFileSync(templatePath, "utf8");

    for (const [category, items] of Object.entries(groupedItems)) {
      const pdfFileName = `${order.orderId}_${category.replace(
        /\s+/g,
        "_"
      )}_${Date.now().toString()}.pdf`;
      const pdfPath = path.join(orderDir, pdfFileName);

      const templateData = {
        order: {
          ...createdOrder,
          orderId: order.orderId,
          deliveryDate: order.deliveryDate,
          deliveryTime: deliveryTime,
          deliveryAddress: deliveryAddress,
          storeLocation: storeLocation,
          deliveryMethod: deliveryMethod,
        },
        customer: customer,
        items: items.map((item) => ({
          ...item,
          title: item.name,
          quantity: item.quantity,
          price: item.price,
          sku: item.sku || "",
          properties: item.properties || [],
        })),
        category: category,
        currency: currency,
        languageCode: languageCode,
        totalPrice: totalPrice,
        formatCurrency: formatCurrency,
      };
      console.log(JSON.stringify(templateData), "templateData");
      const renderedHtml = ejs.render(template, templateData);

      await generatePdfFromHtml(renderedHtml, pdfPath);

      const orderPdf = await prisma.orderPdf.create({
        data: {
          orderId: order.orderId,
          pdfPath: pdfPath,
          status: "pending",
        },
      });

      for (const item of items) {
        await prisma.lineItem.create({
          data: {
            id: BigInt(item.id),
            orderId: order.orderId,
            orderPdfId: orderPdf.id,
            title: item.name,
            productId: BigInt(item.product_id),
            variantId: BigInt(item.variant_id),
            quantity: item.quantity,
            price: item.price,
            sku: item.sku || "",
            category: category,
            properties: item.properties || [],
          },
        });
      }

      try {
        await printer.print(pdfPath, { silent: true });
        await prisma.orderPdf.update({
          where: { id: orderPdf.id },
          data: { status: "success" },
        });
      } catch (printError) {
        await prisma.orderPdf.update({
          where: { id: orderPdf.id },
          data: { status: "failed" },
        });
      }

      console.log(
        `✅ PDF created for Order #${order.orderId}, Category: ${category}`
      );
    }

    console.log(`✅ All category PDFs created for Order #${order.orderId}`);
  } catch (err) {
    console.error(`❌ Error with Order #${order.orderId}:`, err);

    // Update OrderPdf status to failed
    await prisma.orderPdf.updateMany({
      where: { orderId: order.orderId },
      data: { status: "failed" },
    });
  }

  isProcessing = false;
  processQueue();
}

socket.on("open", () => {
  console.log("Connected to server");
  socket.send(JSON.stringify({ message: "Hello from local server!" }));
});

socket.on("message", (data) => {
  const parsed = JSON.parse(data);
  console.log(parsed, "parsed");
  const customer = {
    email: parsed.customer.email,
    first_name: parsed.customer.first_name,
    last_name: parsed.customer.last_name,
    phone: parsed.customer.phone,
  };

  const lineItems = parsed?.line_items || [];
  const totalPrice = parsed?.total_price_set.presentment_money;

  const filteredLineItems = lineItems.map((item) => {
    const categoryProp = item.properties?.find((p) => p.name === "Category");
    const category = categoryProp?.value || "Uncategorized";
    return { ...item, category };
  });

  const response = {
    orderId: parsed.order_number,
    currency: parsed.presentment_currency,
    totalPrice,
    languageCode: parsed.customer_locale,
    customer: customer,
    lineItem: filteredLineItems,
  };
  console.log("Received order:", response);
  enqueueOrder(response);
});
