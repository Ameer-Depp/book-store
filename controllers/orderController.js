const asyncHandler = require("express-async-handler");
const { Order } = require("../models/Order");
const { Book } = require("../models/Book");
const { Cart } = require("../models/Cart");
const { User } = require("../models/User");

const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const cartItems = await Cart.find({ user: userId }).populate("book");

  if (cartItems.length === 0) {
    return res.status(400).json({ message: "Cart is empty" });
  }

  // Check user balance first
  const user = await User.findById(userId).select("balance");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const stockErrors = [];
  let calculatedTotalPrice = 0;

  // Validate all items before processing
  for (const cartItem of cartItems) {
    const book = cartItem.book;

    if (!book) {
      return res.status(404).json({ message: "One or more books not found" });
    }

    // Get fresh stock data
    const currentBook = await Book.findById(book._id).select("stock price");
    if (!currentBook || currentBook.stock < cartItem.quantity) {
      stockErrors.push({
        bookId: book._id,
        title: book.title,
        available: currentBook ? currentBook.stock : 0,
        requested: cartItem.quantity,
      });
    }

    calculatedTotalPrice += currentBook.price * cartItem.quantity;
  }

  if (stockErrors.length > 0) {
    return res.status(400).json({
      message: "Insufficient stock for some items",
      stockErrors: stockErrors,
    });
  }

  if (calculatedTotalPrice > user.balance) {
    return res.status(400).json({
      message: "Insufficient balance in your account",
      required: calculatedTotalPrice,
      available: user.balance,
    });
  }

  // Process order - update stock atomically for each item
  const processedItems = [];
  try {
    for (const cartItem of cartItems) {
      const updateResult = await Book.findOneAndUpdate(
        {
          _id: cartItem.book._id,
          stock: { $gte: cartItem.quantity },
        },
        { $inc: { stock: -cartItem.quantity } },
        { new: true }
      );

      if (!updateResult) {
        throw new Error(`Insufficient stock for book: ${cartItem.book.title}`);
      }

      processedItems.push({
        bookId: cartItem.book._id,
        quantity: cartItem.quantity,
        book: updateResult,
      });
    }

    // Deduct user balance
    await User.findByIdAndUpdate(userId, {
      $inc: { balance: -calculatedTotalPrice },
    });

    // Create order
    const orderItems = processedItems.map((item) => ({
      book: item.bookId,
      quantity: item.quantity,
      price: item.book.price,
    }));

    const newOrder = await Order.create({
      user: userId,
      items: orderItems,
      totalPrice: calculatedTotalPrice,
      status: "pending",
    });

    // Clear cart
    await Cart.deleteMany({ user: userId });

    // Get populated order
    const populatedOrder = await Order.findById(newOrder._id)
      .populate("items.book", "title author price image")
      .populate("user", "username email");

    res.status(201).json({
      message: "Order created successfully",
      order: populatedOrder,
    });
  } catch (error) {
    // Simple rollback - restore stock for processed items
    for (const item of processedItems) {
      await Book.findByIdAndUpdate(item.bookId, {
        $inc: { stock: item.quantity },
      });
    }

    throw error;
  }
});

const getUserOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user.userId })
    .populate("items.book", "title author price image")
    .sort({ createdAt: -1 });

  res.status(200).json({
    message: "Orders retrieved successfully",
    orders: orders,
  });
});

const getOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  // Check if orderId is "all" - this should go to getAllOrders
  if (orderId === "all") {
    return res
      .status(400)
      .json({ message: "Invalid route. Use /api/orders for all orders" });
  }

  const order = await Order.findById(orderId)
    .populate("items.book", "title author price image")
    .populate("user", "username email");

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  if (order.user._id.toString() !== req.user.userId.toString()) {
    return res.status(403).json({ message: "Unauthorized access to order" });
  }

  res.status(200).json({
    message: "Order retrieved successfully",
    order: order,
  });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const validStatuses = [
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      message: "Invalid status",
      validStatuses: validStatuses,
    });
  }

  const order = await Order.findByIdAndUpdate(
    orderId,
    { status: status },
    { new: true }
  );

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  res.status(200).json({
    message: "Order status updated successfully",
    order: order,
  });
});

const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  // No need to check admin here - isAdmin middleware already handles it
  const query = {};

  if (status) {
    query.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const orders = await Order.find(query)
    .populate("items.book", "title author price")
    .populate("user", "username email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const totalOrders = await Order.countDocuments(query);

  res.status(200).json({
    message: "All orders retrieved successfully",
    orders: orders,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrders / parseInt(limit)),
      totalOrders: totalOrders,
      hasNext: parseInt(page) * parseInt(limit) < totalOrders,
      hasPrev: parseInt(page) > 1,
    },
  });
});

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
};
