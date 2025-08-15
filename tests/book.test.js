const request = require("supertest");
const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  createBook,
  getAllBooks,
  getOneBook,
  updateBook,
  deleteBook,
  rateBook,
} = require("../controllers/bookController");
const { Book } = require("../models/Book");
const {
  createBookValidation,
  updateBookValidation,
} = require("../validation/bookValidation");
const { rateBookValidation } = require("../validation/ratingValidation");
const client = require("../config/redis");

// Mock dependencies
jest.mock("../models/Book");
jest.mock("../validation/bookValidation");
jest.mock("../validation/ratingValidation");
jest.mock("../config/redis");
jest.mock("fs");
jest.mock("path");

const app = express();
app.use(express.json());

// Mock middleware
const mockVerifyToken = (req, res, next) => {
  req.user = { id: "testUserId" };
  next();
};

const mockIsAdmin = (req, res, next) => next();

const mockUploadSingle = (fieldname) => (req, res, next) => {
  if (req.body.hasFile) {
    req.file = {
      filename: "test-book-cover.jpg",
      path: "/uploads/test-book-cover.jpg",
    };
  }
  next();
};

// Setup routes
app.get("/books", getAllBooks);
app.get("/books/:id", getOneBook);
app.post(
  "/books",
  mockVerifyToken,
  mockIsAdmin,
  mockUploadSingle("image"),
  createBook
);
app.put(
  "/books/:id",
  mockVerifyToken,
  mockIsAdmin,
  mockUploadSingle("image"),
  updateBook
);
app.delete("/books/:id", mockVerifyToken, mockIsAdmin, deleteBook);
app.post("/books/:bookId/rate", mockVerifyToken, rateBook);

describe("Book Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis operations
    client.get.mockResolvedValue(null);
    client.setEx.mockResolvedValue("OK");
    client.set.mockResolvedValue("OK");
    client.incr.mockResolvedValue(2);

    // Mock file system operations
    fs.existsSync.mockReturnValue(false);
    fs.unlink.mockImplementation((path, callback) => callback(null));
    path.basename.mockReturnValue("test-image.jpg");
    path.join.mockReturnValue("/full/path/to/test-image.jpg");
  });

  describe("GET /books", () => {
    const mockBooks = [
      {
        _id: "book1",
        title: "Test Book 1",
        author: "Author 1",
        price: 19.99,
        stock: 10,
        category: { _id: "cat1", name: "Fiction" },
      },
      {
        _id: "book2",
        title: "Test Book 2",
        author: "Author 2",
        price: 24.99,
        stock: 5,
        category: { _id: "cat2", name: "Non-Fiction" },
      },
    ];

    it("should get all books without cache", async () => {
      client.get.mockResolvedValue(null);
      Book.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockBooks),
      });

      const response = await request(app).get("/books");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBooks);
      expect(Book.find).toHaveBeenCalledWith({});
      expect(client.setEx).toHaveBeenCalled();
    });

    it("should get books from cache when available", async () => {
      client.get.mockResolvedValue(JSON.stringify(mockBooks));

      const response = await request(app).get("/books");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBooks);
      expect(Book.find).not.toHaveBeenCalled();
    });

    it("should filter books by search term", async () => {
      client.get.mockResolvedValue(null);
      const filteredBooks = [mockBooks[0]];

      Book.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(filteredBooks),
      });

      const response = await request(app).get("/books?search=Test Book 1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(filteredBooks);
      expect(Book.find).toHaveBeenCalledWith({
        $text: { $search: "Test Book 1" },
      });
    });

    it("should filter books by category", async () => {
      client.get.mockResolvedValue(null);
      const categoryBooks = [mockBooks[0]];

      Book.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(categoryBooks),
      });

      const response = await request(app).get("/books?category=cat1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(categoryBooks);
      expect(Book.find).toHaveBeenCalledWith({ category: "cat1" });
    });

    it("should handle search errors with fallback", async () => {
      client.get.mockResolvedValue(null);
      Book.find
        .mockReturnValueOnce({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockRejectedValue(new Error("Search error")),
        })
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue(mockBooks),
        });

      const response = await request(app).get("/books?search=test");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBooks);
    });
  });

  describe("GET /books/:id", () => {
    const mockBook = {
      _id: "book1",
      title: "Test Book",
      author: "Test Author",
      price: 19.99,
      category: { _id: "cat1", name: "Fiction" },
    };

    it("should get one book successfully", async () => {
      Book.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBook),
      });

      const response = await request(app).get("/books/book1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockBook);
      expect(Book.findById).toHaveBeenCalledWith("book1");
    });

    it("should return 404 if book not found", async () => {
      Book.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const response = await request(app).get("/books/nonexistent");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Book not found");
    });
  });

  describe("POST /books", () => {
    const validBookData = {
      title: "New Book",
      author: "New Author",
      description: "A great book",
      price: 29.99,
      stock: 15,
      category: "507f1f77bcf86cd799439011",
    };

    it("should create book successfully", async () => {
      createBookValidation.mockReturnValue({
        error: null,
        value: validBookData,
      });
      Book.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      Book.create.mockResolvedValue({
        _id: "newBookId",
        ...validBookData,
      });

      const response = await request(app).post("/books").send(validBookData);

      expect(response.status).toBe(201);
      expect(response.body.title).toBe(validBookData.title);
      expect(Book.create).toHaveBeenCalledWith(validBookData);
      expect(client.incr).toHaveBeenCalledWith("books_cache_version");
    });

    it("should create book with image", async () => {
      createBookValidation.mockReturnValue({
        error: null,
        value: validBookData,
      });
      Book.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      Book.create.mockResolvedValue({
        _id: "newBookId",
        ...validBookData,
        image: "/uploads/test-book-cover.jpg",
      });

      const response = await request(app)
        .post("/books")
        .send({ ...validBookData, hasFile: true });

      expect(response.status).toBe(201);
      expect(Book.create).toHaveBeenCalledWith({
        ...validBookData,
        image: "/uploads/test-book-cover.jpg",
      });
    });

    it("should return 400 for validation errors", async () => {
      createBookValidation.mockReturnValue({
        error: { details: [{ message: "Title is required" }] },
        value: {},
      });

      const response = await request(app).post("/books").send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Title is required");
    });

    it("should return 400 if book already exists", async () => {
      createBookValidation.mockReturnValue({
        error: null,
        value: validBookData,
      });
      Book.findOne.mockResolvedValueOnce({ title: validBookData.title });

      const response = await request(app).post("/books").send(validBookData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Book already exists");
    });

    it("should delete uploaded file on validation error", async () => {
      createBookValidation.mockReturnValue({
        error: { details: [{ message: "Title is required" }] },
        value: {},
      });
      fs.existsSync.mockReturnValue(true);

      const response = await request(app)
        .post("/books")
        .send({ hasFile: true });

      expect(response.status).toBe(400);
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe("PUT /books/:id", () => {
    const updateData = {
      title: "Updated Book",
      price: 34.99,
    };

    const existingBook = {
      _id: "book1",
      title: "Old Book",
      author: "Old Author",
      price: 19.99,
      image: "/uploads/old-image.jpg",
    };

    it("should update book successfully", async () => {
      updateBookValidation.mockReturnValue({
        error: null,
        value: updateData,
      });
      Book.findById.mockResolvedValue(existingBook);
      Book.findOne.mockResolvedValue(null);
      Book.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...existingBook,
          ...updateData,
        }),
      });

      const response = await request(app).put("/books/book1").send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe(updateData.title);
      expect(Book.findByIdAndUpdate).toHaveBeenCalledWith("book1", updateData, {
        new: true,
      });
      expect(client.incr).toHaveBeenCalledWith("books_cache_version");
    });

    it("should return 404 if book not found", async () => {
      updateBookValidation.mockReturnValue({
        error: null,
        value: updateData,
      });
      Book.findById.mockResolvedValue(null);

      const response = await request(app)
        .put("/books/nonexistent")
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Book not found");
    });

    it("should return 400 for validation errors", async () => {
      updateBookValidation.mockReturnValue({
        error: { details: [{ message: "Invalid price" }] },
        value: {},
      });

      const response = await request(app)
        .put("/books/book1")
        .send({ price: -5 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid price");
    });

    it("should replace old image when uploading new one", async () => {
      updateBookValidation.mockReturnValue({
        error: null,
        value: updateData,
      });
      Book.findById.mockResolvedValue(existingBook);
      Book.findOne.mockResolvedValue(null);
      Book.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...existingBook,
          ...updateData,
          image: "/uploads/test-book-cover.jpg",
        }),
      });
      fs.existsSync.mockReturnValue(true);

      const response = await request(app)
        .put("/books/book1")
        .send({ ...updateData, hasFile: true });

      expect(response.status).toBe(200);
      expect(fs.unlink).toHaveBeenCalled(); // Old image deleted
    });

    it("should return 400 if title already exists for another book", async () => {
      updateBookValidation.mockReturnValue({
        error: null,
        value: { title: "Existing Title" },
      });
      Book.findById.mockResolvedValue(existingBook);
      Book.findOne.mockResolvedValue({ _id: "differentBookId" });

      const response = await request(app)
        .put("/books/book1")
        .send({ title: "Existing Title" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Book already exists");
    });
  });

  describe("DELETE /books/:id", () => {
    const mockBook = {
      _id: "book1",
      title: "Book to Delete",
      image: "/uploads/book-image.jpg",
    };

    it("should delete book successfully", async () => {
      Book.findById.mockResolvedValue(mockBook);
      Book.findByIdAndDelete.mockResolvedValue(mockBook);
      fs.existsSync.mockReturnValue(true);

      const response = await request(app).delete("/books/book1");

      expect(response.status).toBe(204);
      expect(Book.findByIdAndDelete).toHaveBeenCalledWith("book1");
      expect(fs.unlink).toHaveBeenCalled();
      expect(client.incr).toHaveBeenCalledWith("books_cache_version");
    });

    it("should return 404 if book not found", async () => {
      Book.findById.mockResolvedValue(null);

      const response = await request(app).delete("/books/nonexistent");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Book not found");
    });

    it("should delete book without image", async () => {
      const bookWithoutImage = { ...mockBook, image: null };
      Book.findById.mockResolvedValue(bookWithoutImage);
      Book.findByIdAndDelete.mockResolvedValue(bookWithoutImage);

      const response = await request(app).delete("/books/book1");

      expect(response.status).toBe(204);
      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });

  describe("POST /books/:bookId/rate", () => {
    const ratingData = { rating: 4 };

    const mockBook = {
      _id: "book1",
      title: "Book to Rate",
      ratings: [],
      save: jest.fn().mockResolvedValue(true),
    };

    it("should rate book successfully (new rating)", async () => {
      rateBookValidation.mockReturnValue({
        error: null,
        value: ratingData,
      });
      Book.findById.mockResolvedValue(mockBook);

      const response = await request(app)
        .post("/books/book1/rate")
        .send(ratingData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Rating submitted");
      expect(mockBook.ratings).toHaveLength(1);
      expect(mockBook.ratings[0]).toEqual({
        userId: "testUserId",
        rating: 4,
      });
      expect(mockBook.save).toHaveBeenCalled();
      expect(client.incr).toHaveBeenCalledWith("books_cache_version");
    });

    it("should update existing rating", async () => {
      const bookWithExistingRating = {
        ...mockBook,
        ratings: [{ userId: "testUserId", rating: 3 }],
        save: jest.fn().mockResolvedValue(true),
      };

      rateBookValidation.mockReturnValue({
        error: null,
        value: ratingData,
      });
      Book.findById.mockResolvedValue(bookWithExistingRating);

      const response = await request(app)
        .post("/books/book1/rate")
        .send(ratingData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Rating submitted");
      expect(bookWithExistingRating.ratings).toHaveLength(1);
      expect(bookWithExistingRating.ratings[0].rating).toBe(4);
      expect(bookWithExistingRating.save).toHaveBeenCalled();
    });

    it("should return 400 for validation errors", async () => {
      rateBookValidation.mockReturnValue({
        error: { details: [{ message: "Rating must be between 1 and 5" }] },
        value: {},
      });

      const response = await request(app)
        .post("/books/book1/rate")
        .send({ rating: 6 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Rating must be between 1 and 5");
    });

    it("should return 404 if book not found", async () => {
      rateBookValidation.mockReturnValue({
        error: null,
        value: ratingData,
      });
      Book.findById.mockResolvedValue(null);

      const response = await request(app)
        .post("/books/nonexistent/rate")
        .send(ratingData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Book not found");
    });
  });
});
