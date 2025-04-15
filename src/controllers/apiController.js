const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const path = require("path");
const fs = require("fs");
const printer = require("pdf-to-printer");

exports.viewPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const pdf = await prisma.orderPdf.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!pdf) {
      return res.status(404).send("PDF not found");
    }

    if (!fs.existsSync(pdf.pdfPath)) {
      return res.status(404).send("PDF file not found");
    }

    const file = fs.createReadStream(pdf.pdfPath);
    res.setHeader("Content-Type", "application/pdf");
    file.pipe(res);
  } catch (error) {
    console.error("View PDF error:", error);
    res.status(500).send("Error viewing PDF");
  }
};

exports.downloadPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const pdf = await prisma.orderPdf.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!pdf) {
      return res.status(404).send("PDF not found");
    }

    if (!fs.existsSync(pdf.pdfPath)) {
      return res.status(404).send("PDF file not found");
    }

    const filename = path.basename(pdf.pdfPath);
    res.download(pdf.pdfPath, filename);
  } catch (error) {
    console.error("Download PDF error:", error);
    res.status(500).send("Error downloading PDF");
  }
};

exports.reprintPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const pdf = await prisma.orderPdf.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!pdf) {
      return res.status(404).json({ success: false, message: "PDF not found" });
    }

    if (!fs.existsSync(pdf.pdfPath)) {
      return res
        .status(404)
        .json({ success: false, message: "PDF file not found" });
    }

    await printer.print(pdf.pdfPath, { silent: true });

    await prisma.orderPdf.update({
      where: { id: parseInt(id, 10) },
      data: { status: "success" },
    });

    res.json({ success: true, message: "PDF sent to printer" });
  } catch (error) {
    console.error("Reprint PDF error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportCsv = async (req, res) => {
  try {
    const filters = {
      orderId: req.query.orderId || "",
      status: req.query.status || "",
      category: req.query.category || "",
      dateFrom: req.query.dateFrom || "",
      dateTo: req.query.dateTo || "",
    };

    const filterConditions = buildFilterConditions(filters);

    let query = {
      where: filterConditions,
      include: {
        order: {
          include: {
            customer: true,
          },
        },
        lineItems: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    };

    if (filters.category) {
      query.where.lineItems = {
        some: {
          category: filters.category,
        },
      };
    }

    const pdfs = await prisma.orderPdf.findMany(query);

    let csvContent =
      "ID,Order ID,Category,Status,Created At,Customer,Items Count\n";

    pdfs.forEach((pdf) => {
      const row = [
        pdf.id,
        pdf.orderId,
        pdf.lineItems[0]?.category || "N/A",
        pdf.status,
        new Date(pdf.createdAt).toISOString(),
        pdf.order?.customer
          ? `${pdf.order.customer.firstName} ${pdf.order.customer.lastName}`
          : "N/A",
        pdf.lineItems.length,
      ];

      csvContent += row.join(",") + "\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=pdf-orders-${Date.now()}.csv`
    );

    res.send(csvContent);
  } catch (error) {
    console.error("Export CSV error:", error);
    res.status(500).send("Error exporting data");
  }
};
