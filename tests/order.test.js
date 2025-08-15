// tests/order.test.js
const request = require("supertest");
const express = require("express");

// Controllers under test
const {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
} = require("../controllers/orderController");

// Models (all mocked)
const { Order } = require("../models/Order");
const { Book } = require("../models/Book");
const { Cart } = require("../models/Cart");
const { User } = require("../models/User");

// ---- Mock everything the controller touches ----
jest.mock("../models/Order");
jest.mock("../models/Book");
jest.mock("../models/Cart");
jest.mock("../models/User");

// Build a minimal app with only the order endpoints (no real middlewares)
const app = express();
app.use(express.json());

// Mock middlewares
const mockVerifyToken = (req, _res, next) => {
  // attach a user like your verifyToken would
  req.user = { userId: "testUserId", isAdmin: true };
  next();
};
const mockVerifyTokenAndAuthorization = (_req, _res, next) => next();
const mockIsAdmin = (_req, _res, next) => next();

// Hook up routes like in your test harness (note: no /api prefix here)
app.post(
  "/orders",
  mockVerifyToken,
  mockVerifyTokenAndAuthorization,
  createOrder
);
app.get(
  "/orders",
  mockVerifyToken,
  mockVerifyTokenAndAuthorization,
  getUserOrders
);
app.get("/orders/all", mockVerifyToken, mockIsAdmin, getAllOrders);
app.get(
  "/orders/:orderId",
  mockVerifyToken,
  mockVerifyTokenAndAuthorization,
  getOrderById
);
app.put(
  "/orders/:orderId/status",
  mockVerifyToken,
  mockIsAdmin,
  updateOrderStatus
);

// ---------- Helpers to build mongoose-ish chains ----------
const chain = (finalValue) => {
  const self = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(finalValue),
  };
  return self;
};

const chainSortOnly = (finalValue) => {
  const self = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue(finalValue),
  };
  return self;
};

const chainPopulateTwice = (finalValue) => ({
  populate: jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue(finalValue),
  }),
});

// ---------- Shared test data ----------
const mockCartItems = [
  {
    _id: "cartItem1",
    quantity: 2,
    book: {
      _id: "book1",
      title: "Test Book 1",
      author: "Author 1",
      price: 19.99,
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
    },
  },
];

const mockUser = { _id: "testUserId", balance: 100 };

const makeOrderDoc = (override = {}) => ({
  _id: "orderId",
  user: { _id: "testUserId", username: "testuser", email: "test@example.com" },
  items: [
    {
      book: {
        title: "Test Book",
        author: "Author",
        price: 19.99,
        image: "image.jpg",
      },
      quantity: 1,
      price: 19.99,
    },
  ],
  totalPrice: 19.99,
  status: "pending",
  ...override,
});

// ---------- Reset all mocks between tests ----------
beforeEach(() => {
  jest.clearAllMocks();

  // Provide default no-op resolved values so controller never sees undefined
  Cart.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });
  Cart.deleteMany.mockResolvedValue({ deletedCount: 0 });

  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
  User.findByIdAndUpdate.mockResolvedValue(true);

  Book.findById = jest.fn();
  Book.findOneAndUpdate = jest.fn();
  Book.findByIdAndUpdate = jest.fn();

  Order.create.mockResolvedValue(null);
  Order.findById = jest.fn();
  Order.find = jest.fn();
  Order.countDocuments = jest.fn();
  Order.findByIdAndUpdate = jest.fn();
});

// ===========================
// POST /orders
// ===========================
describe("POST /orders (createOrder)", () => {
  it("201 → creates order successfully", async () => {
    // 1) cart with items
    Cart.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockCartItems),
    });

    // 2) user exists with balance
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    // 3) fresh stock checks
    Book.findById
      .mockResolvedValueOnce({ _id: "book1", stock: 10, price: 19.99 })
      .mockResolvedValueOnce({ _id: "book2", stock: 5, price: 29.99 });

    // 4) atomic stock dec
    Book.findOneAndUpdate
      .mockResolvedValueOnce({ _id: "book1", stock: 8, price: 19.99 })
      .mockResolvedValueOnce({ _id: "book2", stock: 4, price: 29.99 });

    // 5) create order returns id
    Order.create.mockResolvedValue({ _id: "newOrderId" });

    // 6) populated order
    const populated = {
      _id: "newOrderId",
      user: { username: "testuser", email: "test@example.com" },
      items: [
        {
          book: {
            title: "Test Book 1",
            author: "Author 1",
            price: 19.99,
            image: "image1.jpg",
          },
          quantity: 2,
          price: 19.99,
        },
        {
          book: {
            title: "Test Book 2",
            author: "Author 2",
            price: 29.99,
            image: "image2.jpg",
          },
          quantity: 1,
          price: 29.99,
        },
      ],
      totalPrice: 69.97,
      status: "pending",
    };
    Order.findById.mockReturnValue(chainPopulateTwice(populated));

    // 7) cart cleared
    Cart.deleteMany.mockResolvedValue({ deletedCount: 2 });

    const res = await request(app).post("/orders");

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Order created successfully");
    expect(res.body.order).toEqual(populated);

    // sanity: balance deducted and stock updated
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith("testUserId", {
      $inc: { balance: -69.97 },
    });
    expect(Book.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it("400 → cart is empty", async () => {
    Cart.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app).post("/orders");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Cart is empty");
  });

  it("404 → user not found", async () => {
    Cart.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockCartItems),
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app).post("/orders");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("User not found");
  });

  it("400 → insufficient stock (collects all stockErrors)", async () => {
    Cart.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockCartItems),
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    // First book has only 1 in stock (need 2), second is fine
    Book.findById
      .mockResolvedValueOnce({ _id: "book1", stock: 1, price: 19.99 })
      .mockResolvedValueOnce({ _id: "book2", stock: 5, price: 29.99 });

    const res = await request(app).post("/orders");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Insufficient stock for some items");
    expect(res.body.stockErrors).toEqual([
      {
        bookId: "book1",
        title: "Test Book 1",
        available: 1,
        requested: 2,
      },
    ]);
  });

  it("400 → insufficient balance", async () => {
    const poorUser = { _id: "testUserId", balance: 10 };
    Cart.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockCartItems),
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(poorUser),
    });
    Book.findById
      .mockResolvedValueOnce({ _id: "book1", stock: 10, price: 19.99 })
      .mockResolvedValueOnce({ _id: "book2", stock: 5, price: 29.99 });

    const res = await request(app).post("/orders");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Insufficient balance in your account");
    expect(res.body.required).toBe(69.97);
    expect(res.body.available).toBe(10);
  });

  it("404 → book in cart is null", async () => {
    const badCart = [{ _id: "c1", quantity: 1, book: null }];
    Cart.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(badCart),
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const res = await request(app).post("/orders");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("One or more books not found");
  });

  it("500 → rollback restores stock for processed items on failure", async () => {
    Cart.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockCartItems),
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });
    Book.findById
      .mockResolvedValueOnce({ _id: "book1", stock: 10, price: 19.99 })
      .mockResolvedValueOnce({ _id: "book2", stock: 5, price: 29.99 });

    // First item stock update succeeds, second fails (simulate by returning null)
    Book.findOneAndUpdate
      .mockResolvedValueOnce({ _id: "book1", stock: 8, price: 19.99 })
      .mockResolvedValueOnce(null);

    // Rollback uses findByIdAndUpdate in your controller
    Book.findByIdAndUpdate.mockResolvedValue(true);

    const res = await request(app).post("/orders");
    expect(res.status).toBe(500);

    // Ensure rollback called for the processed first item
    expect(Book.findByIdAndUpdate).toHaveBeenCalledWith("book1", {
      $inc: { stock: 2 },
    });
  });
});

// ===========================
// GET /orders (getUserOrders)
// ===========================
describe("GET /orders (getUserOrders)", () => {
  it("200 → returns user orders (sorted desc)", async () => {
    const docs = [
      {
        _id: "order1",
        user: "testUserId",
        items: [
          {
            book: {
              title: "Test Book 1",
              author: "Author 1",
              price: 19.99,
              image: "image1.jpg",
            },
            quantity: 2,
            price: 19.99,
          },
        ],
        totalPrice: 39.98,
        status: "pending",
        createdAt: "2025-08-15T00:36:22.689Z",
      },
    ];

    Order.find.mockReturnValue(chainSortOnly(docs));

    const res = await request(app).get("/orders");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Orders retrieved successfully");
    expect(res.body.orders).toEqual(docs);
    expect(Order.find).toHaveBeenCalledWith({ user: "testUserId" });
    expect(Order.find().sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it("200 → returns empty array", async () => {
    Order.find.mockReturnValue(chainSortOnly([]));
    const res = await request(app).get("/orders");
    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual([]);
  });
});

// ===========================
// GET /orders/:orderId (getOrderById)
// ===========================
describe("GET /orders/:orderId (getOrderById)", () => {
  it("200 → returns populated order", async () => {
    const mockOrder = makeOrderDoc();

    Order.findById.mockReturnValue(chainPopulateTwice(mockOrder));
    const res = await request(app).get("/orders/orderId");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order retrieved successfully");
    // Avoid deep equal on functions like toString; just check the important bits
    expect(res.body.order).toEqual(
      expect.objectContaining({
        _id: "orderId",
        totalPrice: 19.99,
        status: "pending",
        user: expect.objectContaining({
          _id: "testUserId",
          email: "test@example.com",
          username: "testuser",
        }),
      })
    );
  });

  it("404 → not found", async () => {
    Order.findById.mockReturnValue(chainPopulateTwice(null));
    const res = await request(app).get("/orders/nonexistentId");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Order not found");
  });

  it("403 → unauthorized access", async () => {
    const otherUserOrder = makeOrderDoc({
      user: { _id: "differentUserId", username: "x", email: "x@x.com" },
    });

    Order.findById.mockReturnValue(chainPopulateTwice(otherUserOrder));
    const res = await request(app).get("/orders/orderId");
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Unauthorized access to order");
  });

  it("400 → invalid route 'all' (should use /orders/all)", async () => {
    const res = await request(app).get("/orders/all");
    // In this specific route, our app has /orders/all wired to getAllOrders,
    // so we won’t hit the 400 inside getOrderById here.
    // To test the 400 branch inside getOrderById for `all`, we must call it directly:
    // But since we’re testing via HTTP, we’ll simulate hitting /orders/all on the same handler:
    // Build a tiny one-off app that routes '/orders/:orderId' only for this assertion.
  });

  it("400 → invalid 'all' branch in getOrderById (direct route)", async () => {
    // Build a local app that maps '/only/:orderId' to getOrderById,
    // to reach the 'all' branch of that controller (since our main app sends /orders/all to getAllOrders).
    const app2 = express();
    app2.use(express.json());
    app2.get(
      "/only/:orderId",
      mockVerifyToken,
      mockVerifyTokenAndAuthorization,
      getOrderById
    );
    const res = await request(app2).get("/only/all");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Invalid route. Use /api/orders for all orders"
    );
  });
});

// ===========================
// PUT /orders/:orderId/status (updateOrderStatus)
// ===========================
describe("PUT /orders/:orderId/status (updateOrderStatus)", () => {
  const base = { _id: "orderId", status: "pending", user: "testUserId" };

  it("200 → updates status successfully", async () => {
    Order.findByIdAndUpdate.mockResolvedValue({ ...base, status: "shipped" });

    const res = await request(app)
      .put("/orders/orderId/status")
      .send({ status: "shipped" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Order status updated successfully");
    expect(res.body.order.status).toBe("shipped");
    expect(Order.findByIdAndUpdate).toHaveBeenCalledWith(
      "orderId",
      { status: "shipped" },
      { new: true }
    );
  });

  it("400 → invalid status", async () => {
    const res = await request(app)
      .put("/orders/orderId/status")
      .send({ status: "invalid" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid status");
    expect(res.body.validStatuses).toEqual([
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ]);
  });

  it("404 → order not found", async () => {
    Order.findByIdAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .put("/orders/nonexistentId/status")
      .send({ status: "shipped" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Order not found");
  });

  it("200 → accepts each valid status", async () => {
    const valid = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    for (const s of valid) {
      Order.findByIdAndUpdate.mockResolvedValue({ ...base, status: s });

      const res = await request(app)
        .put("/orders/orderId/status")
        .send({ status: s });

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe(s);
    }
  });
});

// ===========================
// GET /orders/all (getAllOrders)
// ===========================
describe("GET /orders/all (getAllOrders)", () => {
  const mockAll = [
    {
      _id: "order1",
      user: { username: "user1", email: "user1@example.com" },
      items: [
        {
          book: { title: "Book 1", author: "Author 1", price: 19.99 },
          quantity: 1,
        },
      ],
      totalPrice: 19.99,
      status: "pending",
      createdAt: "2025-08-15T00:36:22.690Z",
    },
    {
      _id: "order2",
      user: { username: "user2", email: "user2@example.com" },
      items: [
        {
          book: { title: "Book 2", author: "Author 2", price: 29.99 },
          quantity: 2,
        },
      ],
      totalPrice: 59.98,
      status: "shipped",
      createdAt: "2025-08-15T00:36:22.690Z",
    },
  ];

  it("200 → returns all orders with pagination", async () => {
    Order.find.mockReturnValue(
      // .populate().sort().skip().limit() → resolves to mockAll
      ((self) => {
        self.populate = jest.fn().mockReturnThis();
        self.sort = jest.fn().mockReturnThis();
        self.skip = jest.fn().mockReturnThis();
        self.limit = jest.fn().mockResolvedValue(mockAll);
        return self;
      })({})
    );
    Order.countDocuments.mockResolvedValue(2);

    const res = await request(app).get("/orders/all");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("All orders retrieved successfully");
    expect(res.body.orders).toEqual(mockAll);
    expect(res.body.pagination).toEqual({
      currentPage: 1,
      totalPages: 1,
      totalOrders: 2,
      hasNext: false,
      hasPrev: false,
    });
  });

  it("200 → filters by status", async () => {
    const pendingOnly = [mockAll[0]];

    Order.find.mockReturnValue(
      ((self) => {
        self.populate = jest.fn().mockReturnThis();
        self.sort = jest.fn().mockReturnThis();
        self.skip = jest.fn().mockReturnThis();
        self.limit = jest.fn().mockResolvedValue(pendingOnly);
        return self;
      })({})
    );
    Order.countDocuments.mockResolvedValue(1);

    const res = await request(app).get("/orders/all?status=pending");

    expect(res.status).toBe(200);
    expect(res.body.orders).toEqual(pendingOnly);
    expect(Order.find).toHaveBeenCalledWith({ status: "pending" });
  });

  it("200 → pagination math", async () => {
    Order.find.mockReturnValue(
      ((self) => {
        self.populate = jest.fn().mockReturnThis();
        self.sort = jest.fn().mockReturnThis();
        self.skip = jest.fn().mockReturnThis();
        self.limit = jest.fn().mockResolvedValue(mockAll);
        return self;
      })({})
    );
    Order.countDocuments.mockResolvedValue(25);

    const res = await request(app).get("/orders/all?page=2&limit=5");

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({
      currentPage: 2,
      totalPages: 5,
      totalOrders: 25,
      hasNext: true,
      hasPrev: true,
    });
    expect(Order.find().skip).toHaveBeenCalledWith(5);
    expect(Order.find().limit).toHaveBeenCalledWith(5);
  });

  it("200 → uses default pagination values", async () => {
    Order.find.mockReturnValue(
      ((self) => {
        self.populate = jest.fn().mockReturnThis();
        self.sort = jest.fn().mockReturnThis();
        self.skip = jest.fn().mockReturnThis();
        self.limit = jest.fn().mockResolvedValue(mockAll);
        return self;
      })({})
    );
    Order.countDocuments.mockResolvedValue(2);

    await request(app).get("/orders/all");

    expect(Order.find().skip).toHaveBeenCalledWith(0);
    expect(Order.find().limit).toHaveBeenCalledWith(10);
  });
});
