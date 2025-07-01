const Joi = require("joi");

function addToCartValidation(data) {
  const schema = Joi.object({
    bookId: Joi.string().hex().length(24).required(),
    quantity: Joi.number().integer().min(1).default(1),
  });
  return schema.validate(data);
}

module.exports = { addToCartValidation };
