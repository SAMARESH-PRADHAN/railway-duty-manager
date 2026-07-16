const { Router } = require("express");
const { asyncHandler } = require("../lib/async-handler");
const { resetDemoData } = require("../controllers/seed.controller");

const router = Router();

router.post("/reset", asyncHandler(resetDemoData));

module.exports = router;
