const asyncHandler = require("express-async-handler");
const { Cart } = require("../models/Cart");
const { Book } = require("../models/Book");
const {
  addToCartValidation,
  updateCartValidation,
} = require("../validation/cartValidation");

const addItemToCart = asyncHandler(async (req, res) => {
  const { error, value } = addToCartValidation(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { bookId, quantity } = value;

  const checkBook = await Book.findById(bookId);
  if (!checkBook) {
    return res.status(404).json({ message: "Book not found" });
  }

  let cartItem = await Cart.findOne({
    user: req.user.userId,
    book: bookId,
  });

  const totalQuantity = cartItem ? cartItem.quantity + quantity : quantity;

  if (checkBook.stock < totalQuantity) {
    return res.status(400).json({
      message: "Insufficient stock available",
      available: checkBook.stock,
      requested: totalQuantity,
    });
  }

  if (cartItem) {
    cartItem.quantity += quantity;
    await cartItem.save();

    return res.status(200).json({
      message: "Cart updated successfully",
      cartItem: {
        _id: cartItem._id,
        user: cartItem.user,
        book: cartItem.book,
        quantity: cartItem.quantity,
      },
    });
  } else {
    const newCartItem = await Cart.create({
      user: req.user.userId,
      book: bookId,
      quantity: quantity,
    });

    return res.status(201).json({
      message: "Item added to cart successfully",
      cartItem: newCartItem,
    });
  }
});

const updateCartItem = asyncHandler(async (req, res) => {
  const { error, value } = updateCartValidation(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { itemId } = req.params;
  const { quantity } = value;

  const cartItem = await Cart.findById(itemId);
  if (!cartItem) {
    return res.status(404).json({ message: "Cart item not found" });
  }

  if (cartItem.user.toString() !== req.user.userId.toString()) {
    return res
      .status(403)
      .json({ message: "Unauthorized access to cart item" });
  }

  if (quantity === 0) {
    await Cart.findByIdAndDelete(itemId);
    return res.status(200).json({
      message: "Cart item removed successfully",
      removedItem: {
        _id: cartItem._id,
        book: cartItem.book,
        quantity: cartItem.quantity,
      },
    });
  }

  const book = await Book.findById(cartItem.book);
  if (!book) {
    return res.status(404).json({ message: "Associated book not found" });
  }

  if (book.stock < quantity) {
    return res.status(400).json({
      message: "Insufficient stock available",
      available: book.stock,
      requested: quantity,
    });
  }

  cartItem.quantity = quantity;
  await cartItem.save();

  return res.status(200).json({
    message: "Cart item updated successfully",
    cartItem: {
      _id: cartItem._id,
      user: cartItem.user,
      book: cartItem.book,
      quantity: cartItem.quantity,
    },
  });
});

const getMyCartItems = asyncHandler(async (req, res) => {
  const cartItems = await Cart.find({
    user: req.user.userId,
  })
    .select("book quantity")
    .populate("book", "title author price image stock"); // Only get needed book fields

  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartItems.reduce((sum, item) => {
    return sum + item.book.price * item.quantity;
  }, 0);

  return res.status(200).json({
    message: "Cart retrieved successfully",
    cartItems,
    summary: {
      totalItems: cartItems.length,
      totalQuantity: totalQuantity,
      totalPrice: totalPrice,
    },
  });
});

const deleteCart = asyncHandler(async (req, res) => {
  await Cart.deleteMany({
    user: req.user.userId,
  });
  return res.status(204).json({ message: "cart deleted succesfully" });
});

module.exports = { addItemToCart, getMyCartItems, updateCartItem, deleteCart };
