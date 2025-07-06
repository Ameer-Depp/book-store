const express = require("express");
const {
  addItemToCart,
  getMyCartItems,
  updateCartItem,
  deleteCart,
} = require("../controllers/cartController");
const router = express.Router();
const {
  verifyToken,
  verifyTokenAndAuthorization,
} = require("../middlewares/verfication");

router.delete("/", verifyToken, verifyTokenAndAuthorization, deleteCart);
router.put(
  "/:itemId",
  verifyToken,
  verifyTokenAndAuthorization,
  updateCartItem
);
router.get("/", verifyToken, verifyTokenAndAuthorization, getMyCartItems);
router.post("/", verifyToken, verifyTokenAndAuthorization, addItemToCart);

module.exports = router;
