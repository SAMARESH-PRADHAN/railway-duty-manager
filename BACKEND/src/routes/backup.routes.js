const { Router } = require("express");
const { asyncHandler } = require("../lib/async-handler");
const { exportBackup, restoreBackup } = require("../controllers/backup.controller");

const router = Router();
router.get("/export", asyncHandler(exportBackup));
router.post("/restore", asyncHandler(restoreBackup));

module.exports = router;