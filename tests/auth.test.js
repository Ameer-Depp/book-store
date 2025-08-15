const request = require("supertest");
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  checkAuth,
} = require("../controllers/authController");
const { User } = require("../models/User");
const {
  registerValidation,
  loginValidation,
} = require("../validation/authValidation");

// Mock dependencies
jest.mock("../models/User");
jest.mock("bcrypt");
jest.mock("jsonwebtoken");
jest.mock("../validation/authValidation");

const app = express();
app.use(express.json());

// Mock middleware
const mockVerifyToken = (req, res, next) => {
  req.user = { userId: "testUserId" };
  next();
};

// Setup routes
app.post("/register", registerUser);
app.post("/login", loginUser);
app.post("/logout", logoutUser);
app.get("/profile", mockVerifyToken, getUserProfile);
app.get("/check-auth", mockVerifyToken, checkAuth);

describe("Auth Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /register", () => {
    const validUserData = {
      userName: "John Doe",
      email: "john@example.com",
      password: "password123",
    };

    it("should register a new user successfully", async () => {
      registerValidation.mockReturnValue({
        error: null,
        value: validUserData,
      });
      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashedPassword");
      User.create.mockResolvedValue({
        _id: "userId123",
        userName: "John Doe",
        email: "john@example.com",
        password: "hashedPassword",
        balance: 0.0,
      });

      const response = await request(app).post("/register").send(validUserData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Register successful");
      expect(response.body.user).toEqual({
        id: "userId123",
        name: "John Doe",
        email: "john@example.com",
        balance: 0.0,
      });
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
    });

    it("should return 400 for validation errors", async () => {
      registerValidation.mockReturnValue({
        error: { details: [{ message: "Username is required" }] },
        value: {},
      });

      const response = await request(app)
        .post("/register")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Username is required");
    });

    it("should return 400 if user already exists", async () => {
      registerValidation.mockReturnValue({
        error: null,
        value: validUserData,
      });
      User.findOne.mockResolvedValue({ email: "john@example.com" });

      const response = await request(app).post("/register").send(validUserData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("This user already exists");
    });

    it("should hash password before saving", async () => {
      registerValidation.mockReturnValue({
        error: null,
        value: validUserData,
      });
      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashedPassword");
      User.create.mockResolvedValue({
        _id: "userId123",
        userName: "John Doe",
        email: "john@example.com",
        password: "hashedPassword",
        balance: 0.0,
      });

      await request(app).post("/register").send(validUserData);

      expect(bcrypt.hash).toHaveBeenCalledWith(validUserData.password, 10);
      expect(User.create).toHaveBeenCalledWith({
        userName: validUserData.userName,
        email: validUserData.email,
        password: "hashedPassword",
      });
    });
  });

  describe("POST /login", () => {
    const loginData = {
      email: "john@example.com",
      password: "password123",
    };

    const mockUser = {
      _id: "userId123",
      userName: "John Doe",
      email: "john@example.com",
      password: "hashedPassword",
      balance: 100.0,
      isAdmin: false,
    };

    it("should login user successfully", async () => {
      loginValidation.mockReturnValue({
        error: null,
        value: loginData,
      });
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue("mockToken");

      const response = await request(app).post("/login").send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Login successful");
      expect(response.body.user).toEqual({
        id: mockUser._id,
        name: mockUser.userName,
        email: mockUser.email,
        balance: mockUser.balance,
      });
      expect(response.headers["set-cookie"]).toBeDefined();
    });

    it("should return 400 for validation errors", async () => {
      loginValidation.mockReturnValue({
        error: { details: [{ message: "Email is required" }] },
        value: {},
      });

      const response = await request(app)
        .post("/login")
        .send({ password: "test" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Email is required");
    });

    it("should return 404 if user does not exist", async () => {
      loginValidation.mockReturnValue({
        error: null,
        value: loginData,
      });
      User.findOne.mockResolvedValue(null);

      const response = await request(app).post("/login").send(loginData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Email does not exist");
    });

    it("should return 400 for invalid password", async () => {
      loginValidation.mockReturnValue({
        error: null,
        value: loginData,
      });
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app).post("/login").send(loginData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid credentials");
    });

    it("should generate JWT token with correct payload", async () => {
      loginValidation.mockReturnValue({
        error: null,
        value: loginData,
      });
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue("mockToken");

      await request(app).post("/login").send(loginData);

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: mockUser._id, isAdmin: mockUser.isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
    });

    it("should set secure cookie with token", async () => {
      loginValidation.mockReturnValue({
        error: null,
        value: loginData,
      });
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue("mockToken");

      const response = await request(app).post("/login").send(loginData);

      expect(response.headers["set-cookie"]).toBeDefined();
      const cookieHeader = response.headers["set-cookie"][0];
      expect(cookieHeader).toContain("token=mockToken");
      expect(cookieHeader).toContain("HttpOnly");
      expect(cookieHeader).toContain("SameSite=Strict");
    });
  });

  describe("GET /profile", () => {
    const mockUser = {
      _id: "testUserId",
      userName: "John Doe",
      email: "john@example.com",
      balance: 100.0,
      isAdmin: false,
    };

    it("should get user profile successfully", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const response = await request(app).get("/profile");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockUser);
      expect(User.findById).toHaveBeenCalledWith("testUserId");
    });

    it("should return 404 if user not found", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const response = await request(app).get("/profile");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("User not found");
    });

    it("should exclude password from response", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await request(app).get("/profile");

      expect(User.findById().select).toHaveBeenCalledWith("-password");
    });
  });

  describe("GET /check-auth", () => {
    const mockUser = {
      _id: "testUserId",
      userName: "John Doe",
      email: "john@example.com",
      balance: 100.0,
      isAdmin: false,
    };

    it("should return authenticated user info", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const response = await request(app).get("/check-auth");

      expect(response.status).toBe(200);
      expect(response.body.isAuthenticated).toBe(true);
      expect(response.body.user).toEqual({
        id: mockUser._id,
        name: mockUser.userName,
        email: mockUser.email,
        balance: mockUser.balance,
        isAdmin: mockUser.isAdmin,
      });
    });

    it("should return 404 if user not found", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const response = await request(app).get("/check-auth");

      expect(response.status).toBe(404);
      expect(response.body.isAuthenticated).toBe(false);
      expect(response.body.message).toBe("User not found");
    });
  });

  describe("POST /logout", () => {
    it("should logout user successfully", async () => {
      const response = await request(app).post("/logout");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Logout successful");
    });

    it("should clear the token cookie", async () => {
      const response = await request(app).post("/logout");

      expect(response.headers["set-cookie"]).toBeDefined();
      const cookieHeader = response.headers["set-cookie"][0];
      expect(cookieHeader).toContain("token=;");
      expect(cookieHeader).toContain("HttpOnly");
      expect(cookieHeader).toContain("SameSite=Strict");
    });
  });
});
