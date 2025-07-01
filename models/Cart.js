const { default: mongoose } = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  book: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
  quantity: { type: Number, default: 1 },
});

const Cart = mongoose.model("CartItem", cartItemSchema);

module.exports = { Cart };
