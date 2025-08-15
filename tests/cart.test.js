const request = require("supertest");
const express = require("express");
const {
  addItemToCart,
  getMyCartItems,
  updateCartItem,
  deleteCart,
} = require("../controllers/cartController");
const { Cart } = require("../models/Cart");
const { Book } = require("../models/Book");
const {
  addToCartValidation,
  updateCartValidation,
} = require("../validation/cartValidation");

// Mock dependencies
jest.mock("../models/Cart");
jest.mock("../models/Book");
jest.mock("../validation/cartValidation");

const app = express();
app.use(express.json());

// Mock middleware
const mockVerifyToken = (req, res, next) => {
  req.user = { userId: "testUserId" };
  next();
};

const mockVerifyTokenAndAuthorization = (req, res, next) => next();

// Setup routes
app.post(
  "/cart",
  mockVerifyToken,
  mockVerifyTokenAndAuthorization,
  addItemToCart
);
app.get(
  "/cart",
  mockVerifyToken,
  mockVerifyTokenAndAuthorization,
  getMyCartItems
);
app.put(
  "/cart/:itemId",
  mockVerifyToken,
  mockVerifyTokenAndAuthorization,
  updateCartItem
);
app.delete(
  "/cart",
  mockVerifyToken,
  mockVerifyTokenAndAuthorization,
  deleteCart
);

describe("Cart Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /cart", () => {
    const addToCartData = {
      bookId: "64f5e1234567890abcdef123",
      quantity: 2,
    };

    const mockBook = {
      _id: "64f5e1234567890abcdef123",
      title: "Test Book",
      author: "Test Author",
      price: 19.99,
      stock: 10,
    };

    it("should add new item to cart successfully", async () => {
      addToCartValidation.mockReturnValue({
        error: null,
        value: addToCartData,
      });
      Book.findById.mockResolvedValue(mockBook);
      Cart.findOne.mockResolvedValue(null);
      Cart.create.mockResolvedValue({
        _id: "cartItemId",
        user: "testUserId",
        book: "64f5e1234567890abcdef123",
        quantity: 2,
      });

      const response = await request(app).post("/cart").send(addToCartData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Item added to cart successfully");
      expect(response.body.cartItem).toHaveProperty("_id", "cartItemId");
      expect(Cart.create).toHaveBeenCalledWith({
        user: "testUserId",
        book: "64f5e1234567890abcdef123",
        quantity: 2,
      });
    });

    it("should update existing cart item quantity", async () => {
      const existingCartItem = {
        _id: "existingCartItemId",
        user: "testUserId",
        book: "64f5e1234567890abcdef123",
        quantity: 3,
        save: jest.fn().mockResolvedValue(true),
      };

      addToCartValidation.mockReturnValue({
        error: null,
        value: addToCartData,
      });
      Book.findById.mockResolvedValue(mockBook);
      Cart.findOne.mockResolvedValue(existingCartItem);

      const response = await request(app).post("/cart").send(addToCartData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Cart updated successfully");
      expect(response.body.cartItem.quantity).toBe(5); // 3 + 2
      expect(existingCartItem.save).toHaveBeenCalled();
    });

    it("should return 400 for validation errors", async () => {
      addToCartValidation.mockReturnValue({
        error: { details: [{ message: "Book ID is required" }] },
        value: {},
      });

      const response = await request(app).post("/cart").send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Book ID is required");
    });

    it("should return 404 if book not found", async () => {
      addToCartValidation.mockReturnValue({
        error: null,
        value: addToCartData,
      });
      Book.findById.mockResolvedValue(null);

      const response = await request(app).post("/cart").send(addToCartData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Book not found");
    });

    it("should return 400 if insufficient stock for new item", async () => {
      const lowStockBook = { ...mockBook, stock: 1 };

      addToCartValidation.mockReturnValue({
        error: null,
        value: addToCartData,
      });
      Book.findById.mockResolvedValue(lowStockBook);
      Cart.findOne.mockResolvedValue(null);

      const response = await request(app).post("/cart").send(addToCartData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Insufficient stock available");
      expect(response.body.available).toBe(1);
      expect(response.body.requested).toBe(2);
    });

    it("should return 400 if insufficient stock when updating existing item", async () => {
      const existingCartItem = {
        _id: "existingCartItemId",
        user: "testUserId",
        book: "64f5e1234567890abcdef123",
        quantity: 8,
      };

      const lowStockBook = { ...mockBook, stock: 5 };

      addToCartValidation.mockReturnValue({
        error: null,
        value: addToCartData,
      });
      Book.findById.mockResolvedValue(lowStockBook);
      Cart.findOne.mockResolvedValue(existingCartItem);

      const response = await request(app).post("/cart").send(addToCartData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Insufficient stock available");
      expect(response.body.available).toBe(5);
      expect(response.body.requested).toBe(10); // 8 + 2
    });
  });

  describe("GET /cart", () => {
    const mockCartItems = [
      {
        _id: "cartItem1",
        quantity: 2,
        book: {
          _id: "book1",
          title: "Test Book 1",
          author: "Author 1",
          price: 19.99,
          image: "/uploads/book1.jpg",
          stock: 10,
        },
      },
      {
        _id: "cartItem2",
        quantity: 1,
        book: {
          _id: "book2",
          title: "Test Book 2",
          author: "Author 2",
          price: 29.99,
          image: "/uploads/book2.jpg",
          stock: 5,
        },
      },
    ];

    it("should get cart items successfully", async () => {
      Cart.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockCartItems),
      });

      const response = await request(app).get("/cart");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Cart retrieved successfully");
      expect(response.body.cartItems).toEqual(mockCartItems);
      expect(response.body.summary.totalItems).toBe(2);
      expect(response.body.summary.totalQuantity).toBe(3); // 2 + 1
      expect(response.body.summary.totalPrice).toBe(69.97); // (19.99 * 2) + (29.99 * 1)
    });

    it("should return empty cart", async () => {
      Cart.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([]),
      });

      const response = await request(app).get("/cart");

      expect(response.status).toBe(200);
      expect(response.body.cartItems).toEqual([]);
      expect(response.body.summary.totalItems).toBe(0);
      expect(response.body.summary.totalQuantity).toBe(0);
      expect(response.body.summary.totalPrice).toBe(0);
    });

    it("should filter by user ID and populate book fields", async () => {
      Cart.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockCartItems),
      });

      await request(app).get("/cart");

      expect(Cart.find).toHaveBeenCalledWith({ user: "testUserId" });
      expect(Cart.find().select).toHaveBeenCalledWith("book quantity");
      expect(Cart.find().populate).toHaveBeenCalledWith(
        "book",
        "title author price image stock"
      );
    });
  });

  describe("PUT /cart/:itemId", () => {
    const updateData = { quantity: 5 };

    const mockCartItem = {
      _id: "cartItemId",
      user: "testUserId",
      book: "bookId",
      quantity: 3,
      save: jest.fn().mockResolvedValue(true),
    };

    const mockBook = {
      _id: "bookId",
      title: "Test Book",
      stock: 10,
    };

    it("should update cart item quantity successfully", async () => {
      updateCartValidation.mockReturnValue({
        error: null,
        value: updateData,
      });
      Cart.findById.mockResolvedValue(mockCartItem);
      Book.findById.mockResolvedValue(mockBook);

      const response = await request(app)
        .put("/cart/cartItemId")
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Cart item updated successfully");
      expect(response.body.cartItem.quantity).toBe(5);
      expect(mockCartItem.quantity).toBe(5);
      expect(mockCartItem.save).toHaveBeenCalled();
    });

    it("should remove cart item when quantity is 0", async () => {
      updateCartValidation.mockReturnValue({
        error: null,
        value: { quantity: 0 },
      });
      Cart.findById.mockResolvedValue(mockCartItem);
      Cart.findByIdAndDelete.mockResolvedValue(mockCartItem);

      const response = await request(app)
        .put("/cart/cartItemId")
        .send({ quantity: 0 });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Cart item removed successfully");
      expect(response.body.removedItem).toEqual({
        _id: mockCartItem._id,
        book: mockCartItem.book,
        quantity: mockCartItem.quantity,
      });
      expect(Cart.findByIdAndDelete).toHaveBeenCalledWith("cartItemId");
    });

    it("should return 400 for validation errors", async () => {
      updateCartValidation.mockReturnValue({
        error: {
          details: [{ message: "Quantity must be a positive integer" }],
        },
        value: {},
      });

      const response = await request(app)
        .put("/cart/cartItemId")
        .send({ quantity: -1 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Quantity must be a positive integer");
    });

    it("should return 404 if cart item not found", async () => {
      updateCartValidation.mockReturnValue({
        error: null,
        value: updateData,
      });
      Cart.findById.mockResolvedValue(null);

      const response = await request(app)
        .put("/cart/nonexistent")
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Cart item not found");
    });

    it("should return 403 if user is not authorized", async () => {
      const unauthorizedCartItem = {
        ...mockCartItem,
        user: "differentUserId",
      };

      updateCartValidation.mockReturnValue({
        error: null,
        value: updateData,
      });
      Cart.findById.mockResolvedValue(unauthorizedCartItem);

      const response = await request(app)
        .put("/cart/cartItemId")
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Unauthorized access to cart item");
    });

    it("should return 404 if associated book not found", async () => {
      updateCartValidation.mockReturnValue({
        error: null,
        value: updateData,
      });
      Cart.findById.mockResolvedValue(mockCartItem);
      Book.findById.mockResolvedValue(null);

      const response = await request(app)
        .put("/cart/cartItemId")
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Associated book not found");
    });

    it("should return 400 if insufficient stock", async () => {
      const lowStockBook = { ...mockBook, stock: 2 };

      updateCartValidation.mockReturnValue({
        error: null,
        value: updateData,
      });
      Cart.findById.mockResolvedValue(mockCartItem);
      Book.findById.mockResolvedValue(lowStockBook);

      const response = await request(app)
        .put("/cart/cartItemId")
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Insufficient stock available");
      expect(response.body.available).toBe(2);
      expect(response.body.requested).toBe(5);
    });
  });

  describe("DELETE /cart", () => {
    it("should delete entire cart successfully", async () => {
      Cart.deleteMany.mockResolvedValue({ deletedCount: 3 });

      const response = await request(app).delete("/cart");

      expect(response.status).toBe(204);
      expect(Cart.deleteMany).toHaveBeenCalledWith({ user: "testUserId" });
    });

    it("should delete cart even when empty", async () => {
      Cart.deleteMany.mockResolvedValue({ deletedCount: 0 });

      const response = await request(app).delete("/cart");

      expect(response.status).toBe(204);
      expect(Cart.deleteMany).toHaveBeenCalledWith({ user: "testUserId" });
    });

    it("should filter deletion by user ID", async () => {
      Cart.deleteMany.mockResolvedValue({ deletedCount: 2 });

      await request(app).delete("/cart");

      expect(Cart.deleteMany).toHaveBeenCalledWith({ user: "testUserId" });
    });
  });
});
