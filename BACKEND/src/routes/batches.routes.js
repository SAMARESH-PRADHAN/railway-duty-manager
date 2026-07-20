const express = require("express");
const { asyncHandler } = require("../lib/async-handler");
const {
  listBatches,
  getBatch,
  upsertBatch,
  softDeleteBatch,
  restoreBatch,
} = require("../controllers/batches.controller");

const router = express.Router();

router.get("/", asyncHandler(listBatches));
router.get("/:id", asyncHandler(getBatch));
router.post("/", asyncHandler(upsertBatch));
router.patch("/:id/soft-delete", asyncHandler(softDeleteBatch));
router.patch("/:id/restore", asyncHandler(restoreBatch));

module.exports = router;