const { Router } = require("express");
const { asyncHandler } = require("../lib/async-handler");
const {
  listDesignations, findOrCreateDesignation, updateDesignation, deleteDesignation,
} = require("../controllers/designations.controller");

const router = Router();
router.get("/", asyncHandler(listDesignations));
router.post("/find-or-create", asyncHandler(findOrCreateDesignation));
router.patch("/:id", asyncHandler(updateDesignation));
router.delete("/:id", asyncHandler(deleteDesignation));

module.exports = router;