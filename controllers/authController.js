const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");
const { User } = require("../models/User");
const JWT = require("jsonwebtoken");
const {
  registerValidation,
  loginValidation,
} = require("../validation/authValidation");

const registerUser = asyncHandler(async (req, res) => {
  const { error, value } = registerValidation(req.body);
  const { userName, email, password } = value;
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  const existingUser = await User.findOne({ email: email });
  if (existingUser) {
    return res.status(401).json({ message: "this user is already exists" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    userName: userName,
    email: email,
    password: hashedPassword,
  });

  const token = JWT.sign(
    { userId: newUser._id, isAdmin: newUser.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.status(200).json({
    message: "register successful",
    token,
    user: {
      id: newUser._id,
      name: newUser.userName,
      email: newUser.email,
      balance: newUser.balance,
    },
  });
});

const loginUser = asyncHandler(async (req, res) => {
  const { error, value } = loginValidation(req.body);
  const { email, password } = value;

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  const user = await User.findOne({ email: email });
  if (!user) {
    return res.status(404).json({ message: "email does not exists " });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

  const token = JWT.sign(
    { userId: user._id, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.status(200).json({
    message: "Login successful",
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      balance: user.balance,
    },
  });
});

module.exports = {
  registerUser,
  loginUser,
};
