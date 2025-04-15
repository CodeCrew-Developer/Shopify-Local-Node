const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();


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
