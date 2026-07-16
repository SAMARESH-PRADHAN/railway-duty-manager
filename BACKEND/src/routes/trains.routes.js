const { Router } = require("express");
const { asyncHandler } = require("../lib/async-handler");
const {
  listTrains,
  createTrain,
  updateTrain,
  toggleTrainStatus,
  softDeleteTrain,
  restoreTrain,
} = require("../controllers/trains.controller");

const router = Router();

router.get("/", asyncHandler(listTrains));
router.post("/", asyncHandler(createTrain));
router.patch("/:id", asyncHandler(updateTrain));
router.patch("/:id/toggle-status", asyncHandler(toggleTrainStatus));
router.patch("/:id/soft-delete", asyncHandler(softDeleteTrain));
router.patch("/:id/restore", asyncHandler(restoreTrain));

module.exports = router;
