const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const WebSocket = require("ws");
const printer = require("pdf-to-printer");

const socket = new WebSocket(
  "wss://shopify-server-production-3541.up.railway.app/"
);

let isProcessing = false;
const pendingOrders = [];

function enqueueOrder(order) {
  pendingOrders.push(order);
  processQueue();
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
      },
      create: {
        email: order.customer.email,
        firstName: order.customer.first_name,
        lastName: order.customer.last_name,
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
        lineItems: {
          create: lineItemsData,
        },
      },
    });

    for (const [category, items] of Object.entries(groupedItems)) {
      const pdfFileName = `${order.orderId}_${category.replace(/\s+/g,"_")}_${Date.now().toString()}.pdf`;
      const pdfPath = path.join(orderDir, pdfFileName);

      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: "A4",
      });
      const stream = fs.createWriteStream(pdfPath);

      doc.pipe(stream);

      doc.rect(0, 0, doc.page.width, 120).fill("#f7f7f7");

      doc
        .fontSize(26)
        .fillColor("#333333")
        .font("Helvetica-Bold")
        .text(`ORDER #${order.orderId}`, 50, 50);

      doc
        .fontSize(16)
        .font("Helvetica")
        .fillColor("#666666")
        .text(`Category: ${category}`, 50, 85);

      doc
        .rect(50, 130, doc.page.width - 100, 80)
        .fillAndStroke("#fcfcfc", "#e1e1e1");

      doc
        .fontSize(12)
        .fillColor("#333333")
        .font("Helvetica-Bold")
        .text("CUSTOMER DETAILS", 70, 145);

      doc
        .font("Helvetica")
        .text(`Name: ${customer.firstName} ${customer.lastName}`, 70, 165);

      doc.text(`Email: ${customer.email}`, 70, 185);

      const currentTime = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      doc
        .font("Helvetica-Bold")
        .text("ORDER TIME:", doc.page.width - 300, 145)
        .font("Helvetica")
        .text(currentTime, doc.page.width - 220, 145);

      const tableTop = 230;
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#333333");

      doc.rect(50, tableTop, doc.page.width - 100, 30).fill("#e9e9e9");

      doc.fontSize(12).fillColor("#333333");

      doc.text("QTY", 70, tableTop + 10);
      doc.text("ITEM", 120, tableTop + 10);
      doc.text("PRICE", 350, tableTop + 10);
      doc.text("TOTAL", 450, tableTop + 10);

      let y = tableTop + 40;
      let totalAmount = 0;

      items.forEach((item, index) => {
        let itemName = item.name;
        if (itemName.length > 35) {
          itemName = itemName.substring(0, 32) + "...";
        }

        const textOptions = { width: 220 };
        const textHeight = doc.heightOfString(itemName, textOptions);
        const rowHeight = Math.max(30, textHeight + 10);

        if (index % 2 === 0) {
          doc.rect(50, y - 10, doc.page.width - 100, rowHeight).fill("#f9f9f9");
        }

        doc.font("Helvetica").fontSize(11).fillColor("#333333");

        doc.text(item.quantity.toString(), 70, y);
        doc.text(itemName, 120, y, textOptions);
        doc.text(`$${item.price}`, 350, y);

        const lineTotal = item.quantity * item.price;
        totalAmount += lineTotal;
        doc.text(`$${lineTotal}`, 450, y);

        y += rowHeight;

        if (y > doc.page.height - 250) {
          doc.addPage();
          doc.rect(0, 0, doc.page.width, 50).fill("#f7f7f7");
          doc
            .fontSize(16)
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(`ORDER #${order.orderId} - ${category} (continued)`, 50, 20);
          y = 70;
        }
      });

      const totalY = Math.max(y + 20, doc.page.height - 120);

      doc
        .rect(doc.page.width - 200, totalY - 50, 150, 30)
        .fillAndStroke("#f0f0f0", "#d0d0d0");

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#333333")
        .text("TOTAL:", doc.page.width - 180, totalY - 40);

      doc.text(`$${totalAmount}`, doc.page.width - 100, totalY - 40);

      const footerY = doc.page.height - 100;
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#888888")
        .text(
          "Thank you for your order! Please contact customer service if you have any questions.",
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

  const customer = {
    email: parsed.customer.email,
    first_name: parsed.customer.first_name,
    last_name: parsed.customer.last_name,
    phone: parsed.customer.phone,
  };
  const lineItems = parsed?.line_items || [];

  const filteredLineItems = lineItems.map((item) => {
    const categoryProp = item.properties?.find((p) => p.name === "Category");
    const category = categoryProp?.value || "Uncategorized";
    return { ...item, category };
  });

  const response = {
    orderId: parsed.order_number,
    customer: customer,
    lineItem: filteredLineItems,
  };
  
  enqueueOrder(response);
});
