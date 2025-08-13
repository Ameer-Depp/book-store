const asyncHandler = require("express-async-handler");
const { Book } = require("../models/Book");
const {
  createBookValidation,
  updateBookValidation,
} = require("../validation/bookValidation");
const { rateBookValidation } = require("../validation/ratingValidation");
const client = require("../config/redis");
const fs = require("fs");
const path = require("path");

const CACHE_VERSION_KEY = "books_cache_version";

async function getCacheVersion() {
  let version = await client.get(CACHE_VERSION_KEY);
  if (!version) {
    version = 1;
    await client.set(CACHE_VERSION_KEY, version);
  }
  return version;
}

async function bumpCacheVersion() {
  await client.incr(CACHE_VERSION_KEY);
}

const deleteImageFile = (imagePath) => {
  if (imagePath) {
    const filename = path.basename(imagePath);
    const fullPath = path.join(__dirname, "../uploads", filename);

    if (fs.existsSync(fullPath)) {
      fs.unlink(fullPath, (err) => {
        if (err) {
          console.error("Error deleting image file:", err);
        } else {
          console.log("Image file deleted successfully");
        }
      });
    }
  }
};

const getAllBooks = asyncHandler(async (req, res) => {
  const { search, category } = req.query;
  const version = await getCacheVersion();
  const cacheKey = `books:v${version}:${search || "all"}:${category || "all"}`;

  try {
    const cachedBooks = await client.get(cacheKey);
    if (cachedBooks) {
      console.log("Serving from cache");
      return res.status(200).json(JSON.parse(cachedBooks));
    }

    const query = {};

    if (search) {
      query.$text = { $search: search };
    }

    if (category) {
      query.category = category;
    }

    let booksQuery = Book.find(query).populate("category", "name");

    if (search) {
      booksQuery = booksQuery.sort({ score: { $meta: "textScore" } });
    } else {
      booksQuery = booksQuery.sort({ createdAt: -1 });
    }

    const books = await booksQuery;

    await client.setEx(cacheKey, 3600, JSON.stringify(books));
    console.log("Serving from database with accurate text search!");
    res.status(200).json(books);
  } catch (err) {
    console.error("Search error:", err);

    const fallbackQuery = {};
    if (search) {
      fallbackQuery.title = { $regex: search, $options: "i" };
    }
    if (category) {
      fallbackQuery.category = category;
    }

    const books = await Book.find(fallbackQuery).populate("category", "name");
    res.status(200).json(books);
  }
});

const getOneBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id).populate("category", "name");
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }
  res.status(200).json(book);
});

const createBook = asyncHandler(async (req, res) => {
  const { error, value } = createBookValidation(req.body);
  if (error) {
    if (req.file) {
      deleteImageFile(`/uploads/${req.file.filename}`);
    }
    return res.status(400).json({ message: error.details[0].message });
  }

  const { title, author, description, price, stock, category } = value;

  const exists = await Book.findOne({
    $text: { $search: `"${title}"` },
  });

  const exactMatch = await Book.findOne({ title });

  if (exists || exactMatch) {
    if (req.file) {
      deleteImageFile(`/uploads/${req.file.filename}`);
    }
    return res.status(400).json({ message: "Book already exists" });
  }

  const bookData = {
    title,
    author,
    description,
    price,
    stock,
    category,
  };

  if (req.file) {
    bookData.image = `/uploads/${req.file.filename}`;
  }

  const newBook = await Book.create(bookData);

  await bumpCacheVersion();
  res.status(201).json(newBook);
});

const updateBook = asyncHandler(async (req, res) => {
  const { error, value } = updateBookValidation(req.body);
  if (error) {
    if (req.file) {
      deleteImageFile(`/uploads/${req.file.filename}`);
    }
    return res.status(400).json({ message: error.details[0].message });
  }

  const { title, author, description, price, stock, category } = value;
  const id = req.params.id;

  const bookToUpdate = await Book.findById(id);
  if (!bookToUpdate) {
    if (req.file) {
      deleteImageFile(`/uploads/${req.file.filename}`);
    }
    return res.status(404).json({ message: "Book not found" });
  }

  if (title) {
    const exists = await Book.findOne({ title, _id: { $ne: id } });
    if (exists) {
      if (req.file) {
        deleteImageFile(`/uploads/${req.file.filename}`);
      }
      return res.status(400).json({ message: "Book already exists" });
    }
  }

  const updateData = {};
  if (title) updateData.title = title;
  if (author) updateData.author = author;
  if (description) updateData.description = description;
  if (price) updateData.price = price;
  if (stock !== undefined) updateData.stock = stock;
  if (category) updateData.category = category;

  if (req.file) {
    if (bookToUpdate.image) {
      deleteImageFile(bookToUpdate.image);
    }
    updateData.image = `/uploads/${req.file.filename}`;
  }

  const updatedBook = await Book.findByIdAndUpdate(id, updateData, {
    new: true,
  }).populate("category", "name");

  await bumpCacheVersion();
  res.status(200).json(updatedBook);
});

const deleteBook = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const book = await Book.findById(id);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }

  if (book.image) {
    deleteImageFile(book.image);
  }

  await Book.findByIdAndDelete(id);

  await bumpCacheVersion();
  res.status(204).json({ message: "Book deleted successfully" });
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
    book.ratings[existingRatingIndex].rating = value.rating;
  } else {
    book.ratings.push({ userId: req.user.id, rating: value.rating });
  }

  await book.save();
  await bumpCacheVersion();
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
