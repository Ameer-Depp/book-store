const express = require("express");
const {
  createBook,
  getAllBooks,
  getOneBook,
  updateBook,
  deleteBook,
  rateBook,
} = require("../controllers/bookController");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middlewares/verfication");

// =======================
// 📚 Public Book Routes
// =======================

/**
 * @swagger
 * /api/book:
 *   get:
 *     summary: Get all books
 *     tags: [Book]
 *     responses:
 *       200:
 *         description: A list of books
 */
router.get("/", getAllBooks);

/**
 * @swagger
 * /api/book/{id}:
 *   get:
 *     summary: Get a single book by ID
 *     tags: [Book]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The book ID
 *     responses:
 *       200:
 *         description: Book data
 */
router.get("/:id", getOneBook);

/**
 * @swagger
 * /api/book/{bookId}:
 *   post:
 *     summary: Rate a book
 *     tags: [Book]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the book to rate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 example: 4
 *     responses:
 *       200:
 *         description: Rating submitted
 */
router.post("/:bookId", verifyToken, rateBook);

// =======================
// 🔐 Admin Book Routes
// =======================

/**
 * @swagger
 * /api/book:
 *   post:
 *     summary: Create a new book
 *     tags: [Book]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               author:
 *                 type: string
 *               price:
 *                 type: number
 *               categoryId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Book created
 */
router.post("/", verifyToken, isAdmin, createBook);

/**
 * @swagger
 * /api/book/{id}:
 *   put:
 *     summary: Update a book
 *     tags: [Book]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Book ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               author:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Book updated
 */
router.put("/:id", verifyToken, isAdmin, updateBook);

/**
 * @swagger
 * /api/book/{id}:
 *   delete:
 *     summary: Delete a book
 *     tags: [Book]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Book ID
 *     responses:
 *       200:
 *         description: Book deleted
 */
router.delete("/:id", verifyToken, isAdmin, deleteBook);

module.exports = router;
