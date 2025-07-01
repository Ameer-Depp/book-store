const { default: mongoose } = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: String,
    author: String,
    description: String,
    price: Number,
    stock: Number,
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    image: String, // filename or URL
    ratings: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
        rating: { type: Number, min: 1, max: 5 },
      },
    ],
  },
  { timestamps: true }
);

const Book = mongoose.model("Book", bookSchema);

module.exports = { Book };
