const asyncHandler = require("express-async-handler");
const { Category } = require("../models/Category");
const {
  createCategoryValidation,
} = require("../validation/categoryValidation");

const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find();
  res.status(200).json(categories);
});

const createCategory = asyncHandler(async (req, res) => {
  const { error, value } = createCategoryValidation(req.body);
  const { name } = value;
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  const existCategory = await Category.findOne({ name: name });
  if (existCategory) {
    return res.status(400).json({ message: "Category is Already exists" });
  }
  const newCategory = await Category.create({
    name: name,
  });
  res.status(200).json({
    message: "category has created!",
    Category: { Category: newCategory.name },
  });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const id = req.params.id;

  // Check if category exists
  const category = await Category.findById(id);
  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }
  await Category.findByIdAndDelete(id);
  return res.status(200).json({ message: "Category deleted successfully" });
});

const updateCategory = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const check = await Category.findOne({ _id: id });
  if (!check) {
    return res.status(404).json({ message: "Category is not found" });
  }
  const { error, value } = createCategoryValidation(req.body);
  const { name } = value;
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  const existCategory = await Category.findOne({ name: name });
  if (existCategory) {
    return res.status(400).json({ message: "Category is Already exists" });
  }
  const updatedCategory = await Category.findByIdAndUpdate(
    id,
    {
      $set: {
        name: name,
      },
    },
    { new: true }
  );
  return res.status(200).json({
    message: "Category has been updated",
    category: { name: updatedCategory.name },
  });
});

module.exports = {
  createCategory,
  getAllCategories,
  deleteCategory,
  updateCategory,
};
