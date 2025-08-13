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
const upload = require("../config/uploadConfig");

// =======================
// 📚 Public Book Routes
// =======================

/**
 * @swagger
 * /api/book:
 *   get:
 *     summary: Get all books
 *     tags: [Book]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for book title or author
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category ID
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
 *       404:
 *         description: Book not found
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
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 4
 *     responses:
 *       200:
 *         description: Rating submitted
 *       404:
 *         description: Book not found
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - author
 *               - price
 *               - stock
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *                 example: "The Great Gatsby"
 *               author:
 *                 type: string
 *                 example: "F. Scott Fitzgerald"
 *               description:
 *                 type: string
 *                 example: "A classic American novel"
 *               price:
 *                 type: number
 *                 example: 12.99
 *               stock:
 *                 type: integer
 *                 example: 50
 *               category:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Book cover image (optional)
 *     responses:
 *       201:
 *         description: Book created successfully
 *       400:
 *         description: Validation error or book already exists
 */
router.post("/", verifyToken, isAdmin, upload.single("image"), createBook);

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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "The Great Gatsby"
 *               author:
 *                 type: string
 *                 example: "F. Scott Fitzgerald"
 *               description:
 *                 type: string
 *                 example: "A classic American novel"
 *               price:
 *                 type: number
 *                 example: 12.99
 *               stock:
 *                 type: integer
 *                 example: 50
 *               category:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: New book cover image (optional)
 *     responses:
 *       200:
 *         description: Book updated successfully
 *       404:
 *         description: Book not found
 *       400:
 *         description: Validation error
 */
router.put("/:id", verifyToken, isAdmin, upload.single("image"), updateBook);

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
 *       204:
 *         description: Book deleted successfully
 *       404:
 *         description: Book not found
 */
router.delete("/:id", verifyToken, isAdmin, deleteBook);

module.exports = router;
