const { default: mongoose } = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    balance: {
      type: Number,
      default: 0.0,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("Users", userSchema);
module.exports = { User };
