const { Router } = require("express");
const { asyncHandler } = require("../lib/async-handler");
const {
  listEmployees,
  createEmployee,
  updateEmployee,
  toggleEmployeeStatus,
  softDeleteEmployee,
  restoreEmployee,
} = require("../controllers/employees.controller");

const router = Router();

router.get("/", asyncHandler(listEmployees));
router.post("/", asyncHandler(createEmployee));
router.patch("/:id", asyncHandler(updateEmployee));
router.patch("/:id/toggle-status", asyncHandler(toggleEmployeeStatus));
router.patch("/:id/soft-delete", asyncHandler(softDeleteEmployee));
router.patch("/:id/restore", asyncHandler(restoreEmployee));

module.exports = router;
