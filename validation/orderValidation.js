const Joi = require("joi");

function createOrderValidation(order) {
  const schema = Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          book: Joi.string().hex().length(24).required(),
          quantity: Joi.number().integer().min(1).required(),
        })
      )
      .min(1)
      .required(),
    totalPrice: Joi.number().positive().required(),
  });
  return schema.validate(order);
}

module.exports = { createOrderValidation };
