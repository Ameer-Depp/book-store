const express = require("express");
const { createCode, redeemCode } = require("../controllers/redeemController");
const { verifyToken, isAdmin } = require("../middlewares/verfication");
const router = express.Router();

router.post("/", verifyToken, isAdmin, createCode);
router.post("/redeem", verifyToken, redeemCode);

module.exports = router;
