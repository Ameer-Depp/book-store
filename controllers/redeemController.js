const {
  createCodeValidation,
  redeemCodeValidation,
} = require("../validation/codeValidation");
const { Code } = require("../models/Code");
const { User } = require("../models/User");

const asyncHandler = require("express-async-handler");

const createCode = asyncHandler(async (req, res) => {
  const { error } = createCodeValidation.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { code, value } = req.body;
  const existingCode = await Code.findOne({ code });
  if (existingCode) {
    return res.status(400).json({ message: "this code already exists" });
  }

  const newCode = await Code.create({
    code,
    value,
  });

  res.status(201).json({
    message: "code creation is successful",
    newCode,
  });
});

const redeemCode = asyncHandler(async (req, res) => {
  const { error } = redeemCodeValidation.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { code } = req.body;

  const checkCode = await Code.findOne({
    code: code,
    isActive: true,
    isUsed: false,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });

  if (!checkCode) {
    return res.status(404).json({ message: "invalid code" });
  }

  await Code.findOneAndUpdate(
    { code: code },
    {
      $set: {
        isUsed: true,
        usedBy: req.user.userId,
      },
    },
    { new: true }
  );

  await User.findByIdAndUpdate(
    req.user.userId,
    {
      $inc: { balance: checkCode.value },
    },
    { new: true }
  );

  res.status(200).json({
    message: `${checkCode.value} has been added to your account`,
    redeemed_value: checkCode.value,
  });
});

module.exports = {
  createCode,
  redeemCode,
};
