const Joi = require("joi");

function rateBookValidation(data) {
  const schema = Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
  });
  return schema.validate(data);
}

module.exports = { rateBookValidation };
