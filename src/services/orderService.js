const path = require("path");
const fs = require("fs");
const ejs = require("ejs");
const WebSocket = require("ws");
const printer = require("pdf-to-printer");
const puppeteer = require("puppeteer");
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const department = process.env.DEPARTMENT;
const socketUrl = process.env.WEB_SOCKET_URL

const socket = new WebSocket(
  `${socketUrl}?category=${department}`
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
function formatAddress(address) {
  return `
${address.address1}
${address.address2 ? address.address2 + "\n" : ""}${
    address.company ? address.company + "\n" : ""
  }${address.city}, ${address.province_code} ${address.zip}
${address.country}
`.trim();
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
      const category = item.properties.find(i => i.name == "_"+"Department")?.value;
      if(category.split(" ")[0].toLowerCase() != department) return;

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

    const deliveryTime = order.deliveryTime;
    const deliveryDate = order.deliveryDate;
    const deliveryAddress = order.deliveryAddress;
    const storeLocation = order.storeLocation;
    const deliveryMethod = order.deliveryMethod;
    const orderNote = order.orderNote;

    // Create order record first
    const createdOrder = await prisma.order.create({
      data: {
        id: order.orderId,
        customerId: customer.id,
        deliveryAddress,
        deliveryDate,
        deliveryTime,
        storeLocation,
        deliveryMethod,
        node: orderNote,
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
          deliveryDate,
          deliveryTime,
          deliveryAddress,
          storeLocation,
          deliveryMethod,
          note: orderNote,
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
            id: BigInt(item.id || item.key),
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
  
  const customer = {
    email: parsed.customer.email,
    first_name: parsed.customer.first_name,
    last_name: parsed.customer.last_name,
    phone: parsed.customer.phone,
  };

  const deliveryDate = parsed.note_attributes.find((i) => i.name.includes("Delivery-Date") || i.name.includes("Pickup-Date") )?.value;
  const deliveryTime = parsed.note_attributes.find((i) => i.name.includes("Delivery-Time") || i.name.includes("Pickup-Time"))?.value;
  const deliveryAddress = formatAddress(parsed.shipping_address || parsed.billing_address);

  const numOfCandles = parsed.note_attributes.find((i) => i.name.split(" ").pop() == "Candles")?.value;
  const orderNote = parsed.note;
  const storeLocation = parsed.note_attributes.find((i) =>i.name.includes("Pickup-Location-Company"))?.value;

  const lineItems = parsed?.line_items || [];
  const totalPrice = parsed?.total_price_set;

  const filteredLineItems = lineItems.map((item) => {
    const categoryProp = item.properties.find(i => i.name == "_"+"Department")?.value;
    const category = categoryProp || "Uncategorized";
    return {
      ...item,
      category,
    };
  });

  const response = {
    orderId: parsed.order_number,
    currency: parsed.presentment_currency || "MYR",
    totalPrice,
    languageCode: parsed.customer_locale,
    customer: customer,
    lineItem: filteredLineItems,
    deliveryDate,
    deliveryTime,
    deliveryAddress,
    numOfCandles,
    orderNote,
    storeLocation:storeLocation,
    deliveryMethod: storeLocation ? "Pickup" : "Delivery",
  };
  enqueueOrder(response);
});
