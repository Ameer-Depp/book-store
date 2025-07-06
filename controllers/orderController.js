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

  const stockErrors = [];
  let calculatedTotalPrice = 0;

  for (const cartItem of cartItems) {
    const book = cartItem.book;

    if (!book) {
      return res.status(404).json({ message: "One or more books not found" });
    }

    if (book.stock < cartItem.quantity) {
      stockErrors.push({
        bookId: book._id,
        title: book.title,
        available: book.stock,
        requested: cartItem.quantity,
      });
    }

    calculatedTotalPrice += book.price * cartItem.quantity;
  }

  if (stockErrors.length > 0) {
    return res.status(400).json({
      message: "Insufficient stock for some items",
      stockErrors: stockErrors,
    });
  }

  const user = await User.findOne({ _id: userId }).select("balance");
  if (!user || calculatedTotalPrice > user.balance) {
    return res.status(400).json({
      message: "Insufficient balance in your account",
      required: calculatedTotalPrice,
      available: user ? user.balance : 0,
    });
  }

  try {
    for (const cartItem of cartItems) {
      const updateResult = await Book.updateOne(
        { _id: cartItem.book._id, stock: { $gte: cartItem.quantity } },
        { $inc: { stock: -cartItem.quantity } }
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error(`Insufficient stock for book ${cartItem.book.title}`);
      }
    }

    await User.updateOne(
      { _id: userId },
      { $inc: { balance: -calculatedTotalPrice } }
    );

    const orderItems = cartItems.map((cartItem) => ({
      book: cartItem.book._id,
      quantity: cartItem.quantity,
      price: cartItem.book.price,
    }));

    const newOrder = await Order.create({
      user: userId,
      items: orderItems,
      totalPrice: calculatedTotalPrice,
      status: "pending",
    });

    await Cart.deleteMany({ user: userId });

    const populatedOrder = await Order.findById(newOrder._id)
      .populate("items.book", "title author price image")
      .populate("user", "username email");

    res.status(201).json({
      message: "Order created successfully",
      order: populatedOrder,
    });
  } catch (error) {
    for (const cartItem of cartItems) {
      await Book.updateOne(
        { _id: cartItem.book._id },
        { $inc: { stock: cartItem.quantity } }
      );
    }

    await User.updateOne(
      { _id: userId },
      { $inc: { balance: calculatedTotalPrice } }
    );

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

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  order.status = status;
  await order.save();

  res.status(200).json({
    message: "Order status updated successfully",
    order: order,
  });
});

const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const query = {};

  if (status) {
    query.status = status;
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
    populate: [
      { path: "items.book", select: "title author price" },
      { path: "user", select: "username email" },
    ],
  };

  const orders = await Order.find(query)
    .populate("items.book", "title author price")
    .populate("user", "username email")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const totalOrders = await Order.countDocuments(query);

  res.status(200).json({
    message: "All orders retrieved successfully",
    orders: orders,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders: totalOrders,
      hasNext: page * limit < totalOrders,
      hasPrev: page > 1,
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
