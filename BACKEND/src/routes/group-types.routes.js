const { Router } = require("express");
const { asyncHandler } = require("../lib/async-handler");
const {
  listGroupTypes,
  findOrCreateGroupType,
  updateGroupType,
  deleteGroupType,
} = require("../controllers/group-types.controller");

const router = Router();

router.get("/", asyncHandler(listGroupTypes));
router.post("/find-or-create", asyncHandler(findOrCreateGroupType));
router.patch("/:id", asyncHandler(updateGroupType));
router.delete("/:id", asyncHandler(deleteGroupType));

module.exports = router;