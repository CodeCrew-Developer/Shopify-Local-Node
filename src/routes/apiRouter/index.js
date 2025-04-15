const apiController = require("../../controllers/apiController");
const router = require("express").Router();

router.get("/pdf/view/:id", apiController.viewPdf);
router.get("/pdf/download/:id", apiController.downloadPdf);
router.post("/pdf/reprint/:id", apiController.reprintPdf);

router.get("/export/csv", apiController.exportCsv);

module.exports = router;