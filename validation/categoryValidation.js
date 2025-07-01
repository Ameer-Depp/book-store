const Joi = require("joi");

function createCategoryValidation(category) {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
  });
  return schema.validate(category);
}

module.exports = { createCategoryValidation };
