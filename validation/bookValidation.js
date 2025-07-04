const Joi = require("joi");

function createBookValidation(book) {
  const schema = Joi.object({
    title: Joi.string().min(1).max(255).required(),
    author: Joi.string().min(1).max(100).required(),
    description: Joi.string().min(5).max(1000),
    price: Joi.number().positive().required(),
    stock: Joi.number().integer().min(0).required(),
    category: Joi.string().hex().length(24).required(),
    image: Joi.string().optional(), // only required if passed manually
  });
  return schema.validate(book);
}

function updateBookValidation(book) {
  const schema = Joi.object({
    title: Joi.string().min(1).max(255).optional(),
    author: Joi.string().min(1).max(100).optional(),
    description: Joi.string().min(5).max(1000).optional(),
    price: Joi.number().positive().optional(),
    stock: Joi.number().integer().min(0).optional(),
    category: Joi.string().hex().length(24).optional(),
    image: Joi.string().optional(), // only required if passed manually
  });
  return schema.validate(book);
}

module.exports = { createBookValidation, updateBookValidation };
