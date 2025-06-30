const Joi = require("joi");

function registerValidation(user) {
  const schema = Joi.object({
    userName: Joi.string().min(2).max(50).required(),
    email: Joi.string().min(6).max(50).email().required(),
    password: Joi.string().min(6).max(64).required(),
  });
  return schema.validate(user);
}

function loginValidation(user) {
  const schema = Joi.object({
    email: Joi.string().min(6).max(50).email().required(),
    password: Joi.string().min(6).max(64).required(),
  });
  return schema.validate(user);
}
module.exports = {
  registerValidation,
  loginValidation,
};
