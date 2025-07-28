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

// =======================
// 🛒 Cart Routes
// =======================

/**
 * @swagger
 * /api/cart:
 *   post:
 *     summary: Add item to cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bookId:
 *                 type: string
 *                 example: "64f5e1234567890abcdef123"
 *               quantity:
 *                 type: number
 *                 example: 2
 *     responses:
 *       200:
 *         description: Item added to cart
 *       401:
 *         description: Unauthorized
 */
router.post("/", verifyToken, verifyTokenAndAuthorization, addItemToCart);

/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Get my cart items
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of cart items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   bookId:
 *                     type: string
 *                   quantity:
 *                     type: number
 *                   price:
 *                     type: number
 *       401:
 *         description: Unauthorized
 */
router.get("/", verifyToken, verifyTokenAndAuthorization, getMyCartItems);

/**
 * @swagger
 * /api/cart/{itemId}:
 *   put:
 *     summary: Update cart item
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: The cart item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: number
 *                 example: 3
 *     responses:
 *       200:
 *         description: Cart item updated
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Item not found
 */
router.put(
  "/:itemId",
  verifyToken,
  verifyTokenAndAuthorization,
  updateCartItem
);

/**
 * @swagger
 * /api/cart:
 *   delete:
 *     summary: Delete entire cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart deleted successfully
 *       401:
 *         description: Unauthorized
 */
router.delete("/", verifyToken, verifyTokenAndAuthorization, deleteCart);

module.exports = router;
