const { Router } = require("express");
const { asyncHandler } = require("../lib/async-handler");
const {
  listDutySheets,
  getDutySheet,
  saveDutySheet,
  deleteDutySheet,
} = require("../controllers/duty-sheets.controller");

const router = Router();

router.get("/", asyncHandler(listDutySheets));
router.get("/:id", asyncHandler(getDutySheet));
router.post("/", asyncHandler(saveDutySheet)); // upsert — mirrors saveDutySheet() in DataContext.tsx
router.delete("/:id", asyncHandler(deleteDutySheet));

module.exports = router;
