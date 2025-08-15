const request = require("supertest");
const express = require("express");
const {
  createCategory,
  getAllCategories,
  deleteCategory,
  updateCategory,
} = require("../controllers/categoryController");
const { Category } = require("../models/Category");
const {
  createCategoryValidation,
} = require("../validation/categoryValidation");

// Mock dependencies
jest.mock("../models/Category");
jest.mock("../validation/categoryValidation");

const app = express();
app.use(express.json());

// Mock middleware
const mockVerifyToken = (req, res, next) => {
  req.user = { userId: "testUserId" };
  next();
};

const mockIsAdmin = (req, res, next) => next();

// Setup routes
app.get("/categories", mockVerifyToken, mockIsAdmin, getAllCategories);
app.post("/categories", mockVerifyToken, mockIsAdmin, createCategory);
app.put("/categories/:id", mockVerifyToken, mockIsAdmin, updateCategory);
app.delete("/categories/:id", mockVerifyToken, mockIsAdmin, deleteCategory);

describe("Category Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /categories", () => {
    const mockCategories = [
      {
        _id: "category1",
        name: "FICTION",
      },
      {
        _id: "category2",
        name: "NON-FICTION",
      },
    ];

    it("should get all categories successfully", async () => {
      Category.find.mockResolvedValue(mockCategories);

      const response = await request(app).get("/categories");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCategories);
      expect(Category.find).toHaveBeenCalledWith();
    });

    it("should return empty array when no categories exist", async () => {
      Category.find.mockResolvedValue([]);

      const response = await request(app).get("/categories");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe("POST /categories", () => {
    const validCategoryData = {
      name: "SCIENCE",
    };

    it("should create category successfully", async () => {
      createCategoryValidation.mockReturnValue({
        error: null,
        value: validCategoryData,
      });
      Category.findOne.mockResolvedValue(null);
      Category.create.mockResolvedValue({
        _id: "newCategoryId",
        name: "SCIENCE",
      });

      const response = await request(app)
        .post("/categories")
        .send(validCategoryData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("category has created!");
      expect(response.body.Category).toEqual({
        Category: "SCIENCE",
      });
      expect(Category.create).toHaveBeenCalledWith({
        name: "SCIENCE",
      });
    });

    it("should return 400 for validation errors", async () => {
      createCategoryValidation.mockReturnValue({
        error: { details: [{ message: "Name is required" }] },
        value: {},
      });

      const response = await request(app).post("/categories").send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Name is required");
    });

    it("should return 400 if category already exists", async () => {
      createCategoryValidation.mockReturnValue({
        error: null,
        value: validCategoryData,
      });
      Category.findOne.mockResolvedValue({
        _id: "existingId",
        name: "SCIENCE",
      });

      const response = await request(app)
        .post("/categories")
        .send(validCategoryData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Category is Already exists");
    });

    it("should check for existing category by name", async () => {
      createCategoryValidation.mockReturnValue({
        error: null,
        value: validCategoryData,
      });
      Category.findOne.mockResolvedValue(null);
      Category.create.mockResolvedValue({
        _id: "newCategoryId",
        name: "SCIENCE",
      });

      await request(app).post("/categories").send(validCategoryData);

      expect(Category.findOne).toHaveBeenCalledWith({ name: "SCIENCE" });
    });
  });

  describe("PUT /categories/:id", () => {
    const updateData = {
      name: "UPDATED_CATEGORY",
    };

    const existingCategory = {
      _id: "categoryId",
      name: "OLD_CATEGORY",
    };

    it("should update category successfully", async () => {
      createCategoryValidation.mockReturnValue({
        error: null,
        value: updateData,
      });
      Category.findOne
        .mockResolvedValueOnce(existingCategory) // findOne by id
        .mockResolvedValueOnce(null); // findOne by name
      Category.findByIdAndUpdate.mockResolvedValue({
        _id: "categoryId",
        name: "UPDATED_CATEGORY",
      });

      const response = await request(app)
        .put("/categories/categoryId")
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Category has been updated");
      expect(response.body.category).toEqual({
        name: "UPDATED_CATEGORY",
      });
      expect(Category.findByIdAndUpdate).toHaveBeenCalledWith(
        "categoryId",
        { $set: { name: "UPDATED_CATEGORY" } },
        { new: true }
      );
    });

    it("should return 404 if category not found", async () => {
      Category.findOne.mockResolvedValue(null);

      const response = await request(app)
        .put("/categories/nonexistentId")
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Category is not found");
    });

    it("should return 400 for validation errors", async () => {
      createCategoryValidation.mockReturnValue({
        error: { details: [{ message: "Name must be at least 2 characters" }] },
        value: {},
      });
      Category.findOne.mockResolvedValue(existingCategory);

      const response = await request(app)
        .put("/categories/categoryId")
        .send({ name: "A" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Name must be at least 2 characters");
    });

    it("should return 400 if category name already exists", async () => {
      createCategoryValidation.mockReturnValue({
        error: null,
        value: updateData,
      });
      Category.findOne
        .mockResolvedValueOnce(existingCategory) // findOne by id
        .mockResolvedValueOnce({ _id: "anotherId", name: "UPDATED_CATEGORY" }); // findOne by name

      const response = await request(app)
        .put("/categories/categoryId")
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Category is Already exists");
    });

    it("should check for existing category name before updating", async () => {
      createCategoryValidation.mockReturnValue({
        error: null,
        value: updateData,
      });
      Category.findOne
        .mockResolvedValueOnce(existingCategory)
        .mockResolvedValueOnce(null);
      Category.findByIdAndUpdate.mockResolvedValue({
        _id: "categoryId",
        name: "UPDATED_CATEGORY",
      });

      await request(app).put("/categories/categoryId").send(updateData);

      expect(Category.findOne).toHaveBeenNthCalledWith(1, {
        _id: "categoryId",
      });
      expect(Category.findOne).toHaveBeenNthCalledWith(2, {
        name: "UPDATED_CATEGORY",
      });
    });
  });

  describe("DELETE /categories/:id", () => {
    const mockCategory = {
      _id: "categoryId",
      name: "CATEGORY_TO_DELETE",
    };

    it("should delete category successfully", async () => {
      Category.findById.mockResolvedValue(mockCategory);
      Category.findByIdAndDelete.mockResolvedValue(mockCategory);

      const response = await request(app).delete("/categories/categoryId");

      expect(response.status).toBe(204);
      expect(Category.findById).toHaveBeenCalledWith("categoryId");
      expect(Category.findByIdAndDelete).toHaveBeenCalledWith("categoryId");
    });

    it("should return 404 if category not found", async () => {
      Category.findById.mockResolvedValue(null);

      const response = await request(app).delete("/categories/nonexistentId");

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Category not found");
    });

    it("should not call delete if category not found", async () => {
      Category.findById.mockResolvedValue(null);

      await request(app).delete("/categories/nonexistentId");

      expect(Category.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
});
