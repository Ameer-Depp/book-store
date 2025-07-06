const asyncHandler = require("express-async-handler");
const { Book } = require("../models/Book");
const {
  createBookValidation,
  updateBookValidation,
} = require("../validation/bookValidation");

const { rateBookValidation } = require("../validation/ratingValidation");

const getAllBooks = asyncHandler(async (req, res) => {
  const { search, category } = req.query;
  const query = {};

  if (search) {
    query.title = { $regex: search, $options: "i" }; // case-insensitive
  }

  if (category) {
    query.category = category;
  }

  const books = await Book.find(query).populate("category", "name");
  res.status(200).json(books);
});

const getOneBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    return res.status(404).json({ message: "book not found" });
  }
  res.status(200).json(book);
});

const createBook = asyncHandler(async (req, res) => {
  const { error, value } = createBookValidation(req.body);
  const { title, author, description, price, stock, category } = value;
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  const exists = await Book.findOne({ title: title });
  if (exists) {
    return res.status(400).json({ message: "book already exists" });
  }
  const newBook = await Book.create({
    title: title,
    author: author,
    description: description,
    price: price,
    stock: stock,
    category: category,
  });
  res.status(201).json(newBook);
});
const updateBook = asyncHandler(async (req, res) => {
  const { error, value } = updateBookValidation(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { title, author, description, price, stock, category } = value;
  const id = req.params.id;

  // Check if the book to update exists
  const bookToUpdate = await Book.findById(id);
  if (!bookToUpdate) {
    return res.status(404).json({ message: "Book is not found" });
  }

  const exists = await Book.findOne({ title: title, _id: { $ne: id } });
  if (exists) {
    return res.status(400).json({ message: "book is already exists" });
  }

  const updatedBook = await Book.findByIdAndUpdate(
    id,
    {
      $set: {
        title: title,
        author: author,
        description: description,
        price: price,
        stock: stock,
        category: category,
      },
    },
    { new: true }
  );

  res.status(200).json(updatedBook);
});

const deleteBook = asyncHandler(async (req, res) => {
  const id = req.params.id;

  const book = await Book.findById(id);
  if (!book) {
    return res.status(404).json({ message: "book not found" });
  }
  await Book.findByIdAndDelete(id);
  return res.status(204).json({ message: "Book deleted successfully" });
});

const rateBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const { error, value } = rateBookValidation(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const book = await Book.findById(bookId);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }

  const existingRatingIndex = book.ratings.findIndex(
    (r) => r.userId.toString() === req.user.id
  );

  if (existingRatingIndex !== -1) {
    book.ratings[existingRatingIndex].rating = value.rating; // update existing
  } else {
    book.ratings.push({ userId: req.user.id, rating: value.rating });
  }

  await book.save();

  res.status(200).json({ message: "Rating submitted" });
});

module.exports = {
  createBook,
  getAllBooks,
  getOneBook,
  updateBook,
  deleteBook,
  rateBook,
};
