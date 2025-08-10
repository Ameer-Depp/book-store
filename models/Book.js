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

bookSchema.index({ title: 1 });
bookSchema.index({ category: 1 });
bookSchema.index({ title: 1, category: 1 });
bookSchema.index({ title: "text", author: "text" });
bookSchema.index({ price: 1 });
bookSchema.index({ createdAt: -1 });
bookSchema.index({ stock: 1 });
bookSchema.index({ category: 1, price: 1 });
bookSchema.index({ category: 1, createdAt: -1 });

const Book = mongoose.model("Book", bookSchema);

module.exports = { Book };
