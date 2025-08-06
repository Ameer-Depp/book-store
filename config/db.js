const { default: mongoose } = require("mongoose");

const dbConnection = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log("Connected to mongoDB");
  } catch (error) {
    console.log("faild to connect", error);
    process.exit(1);
  }
};

module.exports = { dbConnection };
