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
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "This user already exists" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    userName,
    email,
    password: hashedPassword,
  });

  res.status(201).json({
    message: "Register successful",
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
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  const { email, password } = value;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "Email does not exist" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  const token = JWT.sign(
    { userId: user._id, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    })
    .status(200)
    .json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.userName,
        email: user.email,
        balance: user.balance,
      },
    });
});

const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.status(200).json(user);
});

const checkAuth = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select("-password");
  if (!user) {
    return res.status(404).json({
      isAuthenticated: false,
      message: "User not found",
    });
  }
  res.status(200).json({
    isAuthenticated: true,
    user: {
      id: user._id,
      name: user.userName,
      email: user.email,
      balance: user.balance,
      isAdmin: user.isAdmin,
    },
  });
});

const logoutUser = asyncHandler(async (req, res) => {
  res
    .clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // only secure in prod
      sameSite: "strict",
      path: "/", // must match the path used when setting the cookie
    })
    .status(200)
    .json({ message: "Logout successful" });
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  checkAuth,
};
