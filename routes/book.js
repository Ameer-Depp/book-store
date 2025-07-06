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

// user routes
router.get("/", getAllBooks);
router.get("/:id", getOneBook);
router.delete("/:id", verifyToken, rateBook);

// Admin routes
router.post("/", verifyToken, isAdmin, createBook);
router.put("/:id", verifyToken, isAdmin, updateBook);
router.delete("/:id", verifyToken, isAdmin, deleteBook);

module.exports = router;
