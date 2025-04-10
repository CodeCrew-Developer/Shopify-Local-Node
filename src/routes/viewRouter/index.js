let express = require("express");
let router = express.Router();

router.get("/", (req, res) => {
  const status = req.query.status || "";
  const dateFrom = req.query.dateFrom || "";
  const dateTo = req.query.dateTo || "";
  const keyword = req.query.keyword || "";
  const page = parseInt(req.query.page) || 1;

  const successCount = 24;
  const pendingCount = 8;
  const failedCount = 5;

  const allPdfs = [
    {
      name: "Invoice_April2025.pdf",
      date: "2025-04-01T10:30:00Z",
      size: "1.2 MB",
      status: "success",
    },
    {
      name: "Contract_Renewal.pdf",
      date: "2025-04-02T14:45:00Z",
      size: "3.5 MB",
      status: "success",
    },
    {
      name: "Project_Proposal.pdf",
      date: "2025-04-03T09:15:00Z",
      size: "2.7 MB",
      status: "success",
    },
    {
      name: "Financial_Report_Q1.pdf",
      date: "2025-04-03T16:20:00Z",
      size: "4.1 MB",
      status: "pending",
    },
    {
      name: "Employee_Handbook.pdf",
      date: "2025-04-04T11:10:00Z",
      size: "5.6 MB",
      status: "success",
    },
    {
      name: "Marketing_Strategy.pdf",
      date: "2025-04-05T13:25:00Z",
      size: "2.3 MB",
      status: "failed",
    },
    {
      name: "Technical_Documentation.pdf",
      date: "2025-04-05T15:40:00Z",
      size: "7.8 MB",
      status: "success",
    },
    {
      name: "Client_Meeting_Notes.pdf",
      date: "2025-04-06T10:05:00Z",
      size: "0.9 MB",
      status: "success",
    },
    {
      name: "Product_Catalog_2025.pdf",
      date: "2025-04-06T14:30:00Z",
      size: "12.4 MB",
      status: "pending",
    },
    {
      name: "Annual_Report_2024.pdf",
      date: "2025-04-07T09:50:00Z",
      size: "8.2 MB",
      status: "success",
    },
    {
      name: "Business_Plan.pdf",
      date: "2025-04-07T16:15:00Z",
      size: "3.7 MB",
      status: "failed",
    },
    {
      name: "Training_Manual.pdf",
      date: "2025-04-08T11:45:00Z",
      size: "6.3 MB",
      status: "pending",
    },
    {
      name: "Research_Findings.pdf",
      date: "2025-04-08T14:20:00Z",
      size: "4.5 MB",
      status: "success",
    },
    {
      name: "Tax_Documents.pdf",
      date: "2025-04-09T10:35:00Z",
      size: "1.8 MB",
      status: "failed",
    },
    {
      name: "Quarterly_Newsletter.pdf",
      date: "2025-04-09T13:50:00Z",
      size: "2.1 MB",
      status: "success",
    },
    {
      name: "Customer_Survey_Results.pdf",
      date: "2025-03-15T11:20:00Z",
      size: "1.7 MB",
      status: "success",
    },
    {
      name: "System_Requirements.pdf",
      date: "2025-03-18T14:10:00Z",
      size: "2.9 MB",
      status: "pending",
    },
    {
      name: "Legal_Agreement.pdf",
      date: "2025-03-20T09:30:00Z",
      size: "3.2 MB",
      status: "success",
    },
    {
      name: "Budget_Planning.pdf",
      date: "2025-03-22T16:45:00Z",
      size: "1.5 MB",
      status: "failed",
    },
    {
      name: "Project_Timeline.pdf",
      date: "2025-03-25T10:15:00Z",
      size: "0.8 MB",
      status: "success",
    },
    {
      name: "Conference_Schedule.pdf",
      date: "2025-03-27T13:40:00Z",
      size: "1.3 MB",
      status: "pending",
    },
    {
      name: "Department_Report.pdf",
      date: "2025-03-28T15:25:00Z",
      size: "2.6 MB",
      status: "success",
    },
    {
      name: "Equipment_Manual.pdf",
      date: "2025-03-30T09:55:00Z",
      size: "5.4 MB",
      status: "success",
    },
    {
      name: "Vendor_Contracts.pdf",
      date: "2025-03-31T14:05:00Z",
      size: "4.7 MB",
      status: "failed",
    },
    {
      name: "Sales_Report_March.pdf",
      date: "2025-04-01T11:30:00Z",
      size: "2.4 MB",
      status: "pending",
    },
    {
      name: "HR_Policies.pdf",
      date: "2025-04-02T09:40:00Z",
      size: "3.1 MB",
      status: "success",
    },
    {
      name: "Customer_Feedback.pdf",
      date: "2025-04-03T13:15:00Z",
      size: "1.6 MB",
      status: "success",
    },
    {
      name: "Strategic_Planning.pdf",
      date: "2025-04-04T16:50:00Z",
      size: "3.8 MB",
      status: "pending",
    },
    {
      name: "IT_Infrastructure.pdf",
      date: "2025-04-05T10:25:00Z",
      size: "2.2 MB",
      status: "success",
    },
    {
      name: "Product_Development.pdf",
      date: "2025-04-06T15:35:00Z",
      size: "4.3 MB",
      status: "success",
    },
    {
      name: "Onboarding_Checklist.pdf",
      date: "2025-04-07T12:20:00Z",
      size: "0.7 MB",
      status: "pending",
    },
    {
      name: "Risk_Assessment.pdf",
      date: "2025-04-08T09:05:00Z",
      size: "3.4 MB",
      status: "success",
    },
    {
      name: "Competitor_Analysis.pdf",
      date: "2025-04-09T14:40:00Z",
      size: "2.8 MB",
      status: "failed",
    },
    {
      name: "Quality_Assurance.pdf",
      date: "2025-04-01T13:10:00Z",
      size: "1.9 MB",
      status: "success",
    },
    {
      name: "Operations_Manual.pdf",
      date: "2025-04-02T16:30:00Z",
      size: "6.7 MB",
      status: "success",
    },
    {
      name: "Expense_Report.pdf",
      date: "2025-04-03T11:55:00Z",
      size: "1.1 MB",
      status: "pending",
    },
    {
      name: "Market_Research.pdf",
      date: "2025-04-04T14:15:00Z",
      size: "3.6 MB",
      status: "success",
    },
  ];

  let filteredPdfs = [...allPdfs];

  if (status) {
    filteredPdfs = filteredPdfs.filter((pdf) => pdf.status === status);
  }

  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    filteredPdfs = filteredPdfs.filter((pdf) => new Date(pdf.date) >= fromDate);
  }

  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    filteredPdfs = filteredPdfs.filter((pdf) => new Date(pdf.date) <= toDate);
  }

  if (keyword) {
    const searchTerm = keyword.toLowerCase();
    filteredPdfs = filteredPdfs.filter((pdf) =>
      pdf.name.toLowerCase().includes(searchTerm)
    );
  }

  const pageSize = 10;
  const totalPDFs = filteredPdfs.length;
  const totalPages = Math.ceil(totalPDFs / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pdfList = filteredPdfs.slice(startIndex, endIndex);

  res.render("index", {
    successCount,
    pendingCount,
    failedCount,

    status,
    dateFrom,
    dateTo,
    keyword,

    pdfList,
    currentPage: page,
    totalPages,
    totalPDFs,
  });
});

module.exports = router;
