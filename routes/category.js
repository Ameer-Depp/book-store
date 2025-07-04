const express = require("express");
const {
  createCategory,
  getAllCategories,
  deleteCategory,
  updateCategory,
} = require("../controllers/categoryController");
const { verifyToken, isAdmin } = require("../middlewares/verfication");
const router = express.Router();

router.get("/", verifyToken, isAdmin, getAllCategories);
router.post("/", verifyToken, isAdmin, createCategory);
router.delete("/:id", verifyToken, isAdmin, deleteCategory);
router.put("/:id", verifyToken, isAdmin, updateCategory);

module.exports = router;
