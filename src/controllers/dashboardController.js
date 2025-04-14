const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const path = require("path");
const fs = require("fs");
const printer = require("pdf-to-printer");

function formatDate(date) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildFilterConditions(filters) {
  const conditions = {};

  if (filters.orderId) {
    conditions.orderId = parseInt(filters.orderId, 10);
  }

  if (
    filters.status &&
    ["success", "failed", "pending"].includes(filters.status)
  ) {
    conditions.status = filters.status;
  }

  if (filters.dateFrom || filters.dateTo) {
    conditions.createdAt = {};

    if (filters.dateFrom) {
      conditions.createdAt.gte = new Date(filters.dateFrom);
    }

    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      conditions.createdAt.lte = dateTo;
    }
  }

  return conditions;
}

exports.getDashboard = async (req, res) => {
  try {
    const filters = {
      orderId: req.query.orderId || "",
      status: req.query.status || "",
      category: req.query.category || "",
      dateFrom: req.query.dateFrom || "",
      dateTo: req.query.dateTo || "",
    };

    const filterConditions = buildFilterConditions(filters);

    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = 10;
    const skip = (page - 1) * pageSize;

    const categoriesResult = await prisma.lineItem.groupBy({
      by: ["category"],
      orderBy: {
        category: "asc",
      },
    });
    const categories = categoriesResult.map((item) => item.category);

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

    const totalCount = await prisma.orderPdf.count({
      where: query.where,
    });

    const pdfs = await prisma.orderPdf.findMany({
      ...query,
      skip,
      take: pageSize,
    });

    const formattedPdfs = pdfs.map((pdf) => ({
      ...pdf,
      customer: pdf.order?.customer,
      itemCount: pdf.lineItems.length,
      category: pdf.lineItems[0]?.category || "N/A",
    }));

    const stats = {
      total: totalCount,
      success: await prisma.orderPdf.count({
        where: { ...filterConditions, status: "success" },
      }),
      failed: await prisma.orderPdf.count({
        where: { ...filterConditions, status: "failed" },
      }),
      pending: await prisma.orderPdf.count({
        where: { ...filterConditions, status: "pending" },
      }),
    };

    const totalPages = Math.ceil(totalCount / pageSize);
    const pagination = {
      currentPage: page,
      totalPages,
      queryParams: new URLSearchParams({
        ...filters,
        page: undefined,
      }).toString(),
    };

    res.render("index", {
      pdfs: formattedPdfs,
      stats,
      filters,
      categories,
      pagination,
      formatDate,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).render("error", {
      message: "Error loading dashboard",
      error,
    });
  }
};

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
