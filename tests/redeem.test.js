const request = require("supertest");
const express = require("express");
const { createCode, redeemCode } = require("../controllers/redeemController");
const { Code } = require("../models/Code");
const { User } = require("../models/User");
const {
  createCodeValidation,
  redeemCodeValidation,
} = require("../validation/codeValidation");

// Mock dependencies
jest.mock("../models/Code");
jest.mock("../models/User");
jest.mock("../validation/codeValidation");

const app = express();
app.use(express.json());

// Mock middleware
const mockVerifyToken = (req, res, next) => {
  req.user = { userId: "testUserId" };
  next();
};

const mockIsAdmin = (req, res, next) => next();

// Setup routes
app.post("/codes", mockVerifyToken, mockIsAdmin, createCode);
app.post("/codes/redeem", mockVerifyToken, redeemCode);

describe("Redeem Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /codes", () => {
    const validCodeData = {
      code: "TESTCODE",
      value: 50.0,
    };

    it("should create code successfully", async () => {
      createCodeValidation.validate.mockReturnValue({
        error: null,
        value: validCodeData,
      });
      Code.findOne.mockResolvedValue(null);
      Code.create.mockResolvedValue({
        _id: "codeId",
        code: "TESTCODE",
        value: 50.0,
        isUsed: false,
        isActive: true,
      });

      const response = await request(app).post("/codes").send(validCodeData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("code creation is successful");
      expect(response.body.newCode).toEqual({
        _id: "codeId",
        code: "TESTCODE",
        value: 50.0,
        isUsed: false,
        isActive: true,
      });
      expect(Code.create).toHaveBeenCalledWith({
        code: "TESTCODE",
        value: 50.0,
      });
    });

    it("should return 400 for validation errors", async () => {
      createCodeValidation.validate.mockReturnValue({
        error: {
          details: [{ message: "Code must be exactly 8 characters long" }],
        },
        value: {},
      });

      const response = await request(app)
        .post("/codes")
        .send({ code: "SHORT", value: 25 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Code must be exactly 8 characters long"
      );
    });

    it("should return 400 if code already exists", async () => {
      createCodeValidation.validate.mockReturnValue({
        error: null,
        value: validCodeData,
      });
      Code.findOne.mockResolvedValue({
        _id: "existingCodeId",
        code: "TESTCODE",
        value: 25.0,
      });

      const response = await request(app).post("/codes").send(validCodeData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("this code already exists");
    });

    it("should check for existing code before creating", async () => {
      createCodeValidation.validate.mockReturnValue({
        error: null,
        value: validCodeData,
      });
      Code.findOne.mockResolvedValue(null);
      Code.create.mockResolvedValue({
        _id: "codeId",
        code: "TESTCODE",
        value: 50.0,
      });

      await request(app).post("/codes").send(validCodeData);

      expect(Code.findOne).toHaveBeenCalledWith({ code: "TESTCODE" });
    });

    it("should handle different code values", async () => {
      const codeWithDifferentValue = { code: "NEWCODE1", value: 100.5 };

      createCodeValidation.validate.mockReturnValue({
        error: null,
        value: codeWithDifferentValue,
      });
      Code.findOne.mockResolvedValue(null);
      Code.create.mockResolvedValue({
        _id: "newCodeId",
        ...codeWithDifferentValue,
      });

      const response = await request(app)
        .post("/codes")
        .send(codeWithDifferentValue);

      expect(response.status).toBe(201);
      expect(Code.create).toHaveBeenCalledWith(codeWithDifferentValue);
    });
  });

  describe("POST /codes/redeem", () => {
    const redeemData = {
      code: "VALIDCODE",
    };

    const validCode = {
      _id: "codeId",
      code: "VALIDCODE",
      value: 75.0,
      isUsed: false,
      isActive: true,
      expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
    };

    const mockUser = {
      _id: "testUserId",
      balance: 25.0,
    };

    it("should redeem code successfully", async () => {
      redeemCodeValidation.validate.mockReturnValue({
        error: null,
        value: redeemData,
      });
      Code.findOne.mockResolvedValue(validCode);
      Code.findOneAndUpdate.mockResolvedValue({
        ...validCode,
        isUsed: true,
        usedBy: "testUserId",
      });
      User.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        balance: 100.0,
      });

      const response = await request(app)
        .post("/codes/redeem")
        .send(redeemData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("75 has been added to your account");
      expect(response.body.redeemed_value).toBe(75.0);
    });

    it("should return 400 for validation errors", async () => {
      redeemCodeValidation.validate.mockReturnValue({
        error: {
          details: [{ message: "Code must be exactly 8 characters long" }],
        },
        value: {},
      });

      const response = await request(app)
        .post("/codes/redeem")
        .send({ code: "SHORT" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        "Code must be exactly 8 characters long"
      );
    });

    it("should return 404 if code not found", async () => {
      redeemCodeValidation.validate.mockReturnValue({
        error: null,
        value: redeemData,
      });
      Code.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post("/codes/redeem")
        .send(redeemData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("invalid code");
    });

    it("should return 404 if code is already used", async () => {
      const usedCode = { ...validCode, isUsed: true };

      redeemCodeValidation.validate.mockReturnValue({
        error: null,
        value: redeemData,
      });
      Code.findOne.mockResolvedValue(null); // findOne with conditions returns null for used codes

      const response = await request(app)
        .post("/codes/redeem")
        .send(redeemData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("invalid code");
    });

    it("should return 404 if code is inactive", async () => {
      redeemCodeValidation.validate.mockReturnValue({
        error: null,
        value: redeemData,
      });
      Code.findOne.mockResolvedValue(null); // findOne with isActive: true returns null

      const response = await request(app)
        .post("/codes/redeem")
        .send(redeemData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("invalid code");
    });

    it("should return 404 if code is expired", async () => {
      redeemCodeValidation.validate.mockReturnValue({
        error: null,
        value: redeemData,
      });
      Code.findOne.mockResolvedValue(null); // findOne with expiry condition returns null

      const response = await request(app)
        .post("/codes/redeem")
        .send(redeemData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("invalid code");
    });

    it("should check code with correct conditions", async () => {
      redeemCodeValidation.validate.mockReturnValue({
        error: null,
        value: redeemData,
      });
      Code.findOne.mockResolvedValue(validCode);
      Code.findOneAndUpdate.mockResolvedValue(validCode);
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      await request(app).post("/codes/redeem").send(redeemData);

      expect(Code.findOne).toHaveBeenCalledWith({
        code: "VALIDCODE",
        isActive: true,
        isUsed: false,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: expect.any(Date) } }],
      });
    });

    it("should mark code as used and update user balance", async () => {
      redeemCodeValidation.validate.mockReturnValue({
        error: null,
        value: redeemData,
      });
      Code.findOne.mockResolvedValue(validCode);
      Code.findOneAndUpdate.mockResolvedValue(validCode);
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      await request(app).post("/codes/redeem").send(redeemData);

      expect(Code.findOneAndUpdate).toHaveBeenCalledWith(
        { code: "VALIDCODE" },
        {
          $set: {
            isUsed: true,
            usedBy: "testUserId",
          },
        },
        { new: true }
      );

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "testUserId",
        {
          $inc: { balance: 75.0 },
        },
        { new: true }
      );
    });

    it("should handle codes without expiration date", async () => {
      const codeWithoutExpiry = { ...validCode, expiresAt: null };

      redeemCodeValidation.validate.mockReturnValue({
        error: null,
        value: redeemData,
      });
      Code.findOne.mockResolvedValue(codeWithoutExpiry);
      Code.findOneAndUpdate.mockResolvedValue(codeWithoutExpiry);
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      const response = await request(app)
        .post("/codes/redeem")
        .send(redeemData);

      expect(response.status).toBe(200);
      expect(response.body.redeemed_value).toBe(75.0);
    });

    it("should handle decimal code values", async () => {
      const codeWithDecimal = { ...validCode, value: 12.75 };

      redeemCodeValidation.validate.mockReturnValue({
        error: null,
        value: redeemData,
      });
      Code.findOne.mockResolvedValue(codeWithDecimal);
      Code.findOneAndUpdate.mockResolvedValue(codeWithDecimal);
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      const response = await request(app)
        .post("/codes/redeem")
        .send(redeemData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        "12.75 has been added to your account"
      );
      expect(response.body.redeemed_value).toBe(12.75);
    });
  });
});
