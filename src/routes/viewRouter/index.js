let express = require("express");
let router = express.Router();
const _ = require("lodash");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  const status = req.query.status || "";
  const dateFrom = req.query.dateFrom || "";
  const dateTo = req.query.dateTo || "";
  const keyword = req.query.keyword || "";
  const page = parseInt(req.query.page) || 1;

  const pageSize = 10;
  const whereClause = {};

  // Build filter conditions
  if (status) whereClause.status = status;
  if (dateFrom) whereClause.order = { createdAt: { gte: new Date(dateFrom) } };
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    whereClause.order = {
      ...(whereClause.order || {}),
      createdAt: {
        ...(whereClause.order?.createdAt || {}),
        lte: toDate,
      },
    };
  }
  if (keyword) {
    whereClause.title = { contains: keyword, mode: "insensitive" };
  }

  try {
    const [successCount, pendingCount, failedCount] = await Promise.all([
      prisma.lineItem.count({ where: { status: "success" } }),
      prisma.lineItem.count({ where: { status: "pending" } }),
      prisma.lineItem.count({ where: { status: "failed" } }),
    ]);
    const totalPDFs = await prisma.lineItem.count({ where: whereClause });

    const lineItems = await prisma.lineItem.findMany({
      where: whereClause,
      include: {
        order: true,
      },
      orderBy: { order: { createdAt: "asc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const pdfList = lineItems.map((item) => ({
      order: item.orderId,
      name: item.title,
      pdfPath: item.pdfPath.split('order-pdf')[1]?.replaceAll('\\','/') || "",
      date: item?.order.createdAt.toISOString() || "unknown",
      size: "N/A",
      status: item.status || "unknown",
    }));

    const groupedPdfList = _.groupBy(pdfList, "order");

    res.render("index", {
      successCount,
      pendingCount,
      failedCount,

      status,
      dateFrom,
      dateTo,
      keyword,

      pdfList: groupedPdfList,
      currentPage: page,
      totalPages: Math.ceil(totalPDFs / pageSize),
      totalPDFs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
