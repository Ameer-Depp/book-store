const Joi = require("joi");

const createCodeValidation = Joi.object({
  code: Joi.string().required().length(8).alphanum().uppercase().messages({
    "string.length": "Code must be exactly 8 characters long",
    "string.alphanum": "Code must contain only letters and numbers",
  }),
  value: Joi.number().required().min(0.01).precision(2).messages({
    "number.min": "Value must be greater than 0",
    "number.precision": "Value can have maximum 2 decimal places",
  }),
  expiresAt: Joi.date().optional().min("now").messages({
    "date.min": "Expiration date must be in the future",
  }),
  isActive: Joi.boolean().optional(),
});

const redeemCodeValidation = Joi.object({
  code: Joi.string().required().length(8).alphanum().uppercase().messages({
    "string.length": "Code must be exactly 8 characters long",
    "string.alphanum": "Code must contain only letters and numbers",
  }),
});

module.exports = {
  createCodeValidation,
  redeemCodeValidation,
};
