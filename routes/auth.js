const express = require("express");
const {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  checkAuth,
} = require("../controllers/authController");
const { verifyToken } = require("../middlewares/verfication");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.get("/check-auth", verifyToken, checkAuth);
router.get("/profile", verifyToken, getUserProfile);

module.exports = router;
