const express = require("express");
const {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
} = require("../controllers/orderController");
const {
  verifyToken,
  isAdmin,
  verifyTokenAndAuthorization,
} = require("../middlewares/verfication");

const router = express.Router();

router.post("/", verifyToken, verifyTokenAndAuthorization, createOrder);
router.get("/", verifyToken, verifyTokenAndAuthorization, getUserOrders);
router.get("/all", verifyToken, isAdmin, getAllOrders);
router.get("/:orderId", verifyToken, verifyTokenAndAuthorization, getOrderById);
router.put("/:orderId/status", verifyToken, isAdmin, updateOrderStatus);

module.exports = router;
