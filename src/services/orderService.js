const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const WebSocket = require("ws");
const printer = require("pdf-to-printer");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const socket = new WebSocket(
  "wss://shopify-server-production-3541.up.railway.app/"
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

    const deliveryDate = new Date(
      order.deliveryDate ? order.deliveryDate : {}
    ).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const currency = order.currency;
    const languageCode = order.languageCode;
    const totalPrice = order.totalPrice

    const deliveryTime = order.deliveryTime || "Not specified";
    const deliveryAddress = order.deliveryAddress || "Not specified";
    const storeLocation = order.storeLocation || "Not specified";
    const deliveryMethod = order.deliveryMethod || "Not specified";

    const lineItemsData = order.lineItem.map((item) => {
      const category =
        item.properties?.find((p) => p.name === "Category")?.value ||
        "Uncategorized";
      return {
        id: BigInt(item.id),
        title: item.name,
        productId: BigInt(item.product_id),
        variantId: BigInt(item.variant_id),
        quantity: item.quantity,
        price: item.price,
        sku: item.sku || "",
        category: category,
        properties: item.properties || [],
        status: "pending",
        pdfPath: "",
      };
    });

    await prisma.order.create({
      data: {
        id: order.orderId,
        customerId: customer.id,
        deliveryAddress: deliveryAddress,
        deliveryDate: order.deliveryDate,
        deliveryTime: deliveryTime,
        storeLocation: storeLocation,
        deliveryMethod: deliveryMethod,
        node: order.node || null,
        customAttributes: order.customAttributes || {},
        lineItems: {
          create: lineItemsData,
        },
      },
    });

    for (const [category, items] of Object.entries(groupedItems)) {
      const pdfFileName = `${order.orderId}_${category.replace(
        /\s+/g,
        "_"
      )}_${Date.now().toString()}.pdf`;
      const pdfPath = path.join(orderDir, pdfFileName);

      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: "A4",
      });
      const stream = fs.createWriteStream(pdfPath);

      doc.pipe(stream);

      doc.rect(0, 0, doc.page.width, 140).fill("#f0f4f8");

      doc
        .fontSize(28)
        .fillColor("#1a3a5f")
        .font("Helvetica-Bold")
        .text(`ORDER #${order.orderId}`, 50, 50);

      doc
        .fontSize(16)
        .font("Helvetica")
        .fillColor("#4a6584")
        .text(`Category: ${category}`, 50, 85);

      const currentTime = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      doc
        .fontSize(10)
        .fillColor("#627d98")
        .text(`Generated: ${currentTime}`, 50, 110);

      const customerBoxY = 160;
      doc
        .roundedRect(50, customerBoxY, (doc.page.width - 100) / 2 - 10, 160, 5)
        .fillAndStroke("#f8f9fa", "#d0d7de");

      doc
        .fontSize(14)
        .fillColor("#1a3a5f")
        .font("Helvetica-Bold")
        .text("CUSTOMER", 70, customerBoxY + 15);

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#334e68")
        .text("Name:", 70, customerBoxY + 40)
        .font("Helvetica")
        .text(
          `${customer.firstName} ${customer.lastName}`,
          160,
          customerBoxY + 40
        );

      doc
        .font("Helvetica-Bold")
        .text("Email:", 70, customerBoxY + 65)
        .font("Helvetica")
        .text(customer.email, 160, customerBoxY + 65);

      doc
        .font("Helvetica-Bold")
        .text("Phone:", 70, customerBoxY + 90)
        .font("Helvetica")
        .text(customer.phone, 160, customerBoxY + 90);

      const deliveryBoxX = doc.page.width / 2 + 10;
      doc
        .roundedRect(
          deliveryBoxX,
          customerBoxY,
          (doc.page.width - 100) / 2 - 10,
          160,
          5
        )
        .fillAndStroke("#f0f7ff", "#bfdcff");

      doc
        .fontSize(14)
        .fillColor("#1a3a5f")
        .font("Helvetica-Bold")
        .text("DELIVERY DETAILS", deliveryBoxX + 20, customerBoxY + 15);

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#334e68")
        .text("Method:", deliveryBoxX + 20, customerBoxY + 40)
        .font("Helvetica")
        .text(deliveryMethod, deliveryBoxX + 120, customerBoxY + 40);

      doc
        .font("Helvetica-Bold")
        .text("Date:", deliveryBoxX + 20, customerBoxY + 65)
        .font("Helvetica")
        .text(deliveryDate, deliveryBoxX + 120, customerBoxY + 65);

      doc
        .font("Helvetica-Bold")
        .text("Time:", deliveryBoxX + 20, customerBoxY + 90)
        .font("Helvetica")
        .text(deliveryTime, deliveryBoxX + 120, customerBoxY + 90);

      doc
        .font("Helvetica-Bold")
        .text("Address:", deliveryBoxX + 20, customerBoxY + 115)
        .font("Helvetica")
        .text(deliveryAddress, deliveryBoxX + 120, customerBoxY + 115, {
          width: 200,
          height: 40,
          ellipsis: true,
        });

      doc
        .font("Helvetica-Bold")
        .text("Store:", deliveryBoxX + 20, customerBoxY + 140)
        .font("Helvetica")
        .text(storeLocation, deliveryBoxX + 120, customerBoxY + 140);

      const tableTop = customerBoxY + 180;

      doc
        .roundedRect(50, tableTop, doc.page.width - 100, 30, 3)
        .fillAndStroke("#1a3a5f", "#1a3a5f");

      doc.fontSize(12).fillColor("#ffffff");

      doc.text("QTY", 70, tableTop + 10);
      doc.text("ITEM", 120, tableTop + 10);
      doc.text("SKU", 280, tableTop + 10);
      doc.text("PRICE", 380, tableTop + 10);
      doc.text("TOTAL", 480, tableTop + 10);

      let y = tableTop + 40;
      let totalAmount = 0;
      let itemCount = 0;

      items.forEach((item, index) => {
        itemCount++;
        let itemName = item.name;
        if (itemName.length > 30) {
          itemName = itemName.substring(0, 27) + "...";
        }

        const textOptions = { width: 150 };
        const textHeight = doc.heightOfString(itemName, textOptions);
        const rowHeight = Math.max(30, textHeight + 10);

        // Alternating row colors
        if (index % 2 === 0) {
          doc
            .roundedRect(50, y - 10, doc.page.width - 100, rowHeight, 2)
            .fillAndStroke("#f5f7fa", "#e1e8f0");
        }

        doc.font("Helvetica").fontSize(11).fillColor("#334e68");

        doc.text(item.quantity.toString(), 70, y);
        doc.text(itemName, 120, y, textOptions);
        doc.text(item.sku || "N/A", 280, y);
        doc.text(formatCurrency(item.price, currency, languageCode), 380, y);

        const lineTotal = item.quantity * item.price;
        totalAmount += lineTotal;
        doc.text(formatCurrency(item.price, currency, languageCode), 480, y);

        // Show properties if available
        if (item.properties && item.properties.length > 0) {
          y += rowHeight;
          doc.font("Helvetica-Oblique").fontSize(9).fillColor("#627d98");

          const propText = item.properties
            .filter((p) => p.name !== "Category")
            .map((p) => `${p.name}: ${p.value}`)
            .join(", ");

          if (propText) {
            doc.text(`Properties: ${propText}`, 120, y, { width: 350 });
            y += doc.heightOfString(propText, { width: 350 }) + 5;
          } else {
            y -= rowHeight; // Reset if no properties to display
          }
        }

        y += rowHeight;

        // Check if we need a new page
        if (y > doc.page.height - 250) {
          doc.addPage();
          doc.rect(0, 0, doc.page.width, 60).fill("#f0f4f8");
          doc
            .fontSize(18)
            .fillColor("#1a3a5f")
            .font("Helvetica-Bold")
            .text(`ORDER #${order.orderId} - ${category} (continued)`, 50, 20);

          // Recreate the table header
          y = 80;
          doc
            .roundedRect(50, y, doc.page.width - 100, 30, 3)
            .fillAndStroke("#1a3a5f", "#1a3a5f");

          doc.fontSize(12).fillColor("#ffffff");

          doc.text("QTY", 70, y + 10);
          doc.text("ITEM", 120, y + 10);
          doc.text("SKU", 280, y + 10);
          doc.text("PRICE", 380, y + 10);
          doc.text("TOTAL", 480, y + 10);

          y += 40;
        }
      });

      // Order Summary Box
      const summaryY = y + 20;

      doc
        .roundedRect(doc.page.width - 250, summaryY, 200, 100, 5)
        .fillAndStroke("#f0f7ff", "#c1d8f0");

      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor("#1a3a5f")
        .text("ORDER SUMMARY", doc.page.width - 220, summaryY + 15);

      doc.fontSize(11).text("Items:", doc.page.width - 220, summaryY + 40);
      doc
        .font("Helvetica")
        .text(itemCount.toString(), doc.page.width - 110, summaryY + 40);

      doc
        .font("Helvetica-Bold")
        .text("Total Items:", doc.page.width - 220, summaryY + 60);
      doc
        .font("Helvetica")
        .text(
          items.reduce((sum, item) => sum + item.quantity, 0).toString(),
          doc.page.width - 110,
          summaryY + 60
        );

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .text("TOTAL:", doc.page.width - 220, summaryY + 80);
      doc.text(formatCurrency(totalPrice.amount, totalPrice.currency_code, languageCode), doc.page.width - 110, summaryY + 80);

      const footerY = doc.page.height - 100;

      doc
        .moveTo(50, footerY - 20)
        .lineTo(doc.page.width - 50, footerY - 20)
        .strokeColor("#d0d7de")
        .stroke();

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#627d98")
        .text(
          `Thank you for your order! If you have any questions about your order #${order.orderId}, please contact our customer service.`,
          50,
          footerY,
          { align: "center", width: doc.page.width - 100 }
        );

      doc.end();

      stream.on("finish", async () => {
        await printer.print(pdfPath, { silent: true });
      });

      await prisma.lineItem.updateMany({
        where: {
          orderId: order.orderId,
          category: category,
        },
        data: {
          status: "success",
          pdfPath: pdfPath,
        },
      });

      console.log(
        `✅ PDF created for Order #${order.orderId}, Category: ${category}`
      );
    }

    console.log(`✅ All category PDFs created for Order #${order.orderId}`);
  } catch (err) {
    console.error(`❌ Error with Order #${order.orderId}:`, err);

    await prisma.lineItem.updateMany({
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
