const express = require("express");
const dotenv = require("dotenv");
const { dbConnection } = require("./config/db");

//load configerations
dotenv.config();

//connect to database
dbConnection();

//initiaite the app
const app = express();

//middlewares
app.use(express.json());

//end points
app.use("/api/auth", require("./routes/auth"));

//start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`server is running on PORT: ${PORT}`);
});
