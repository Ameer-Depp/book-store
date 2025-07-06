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
app.use("/api/category", require("./routes/category"));
app.use("/api/book", require("./routes/book"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/order", require("./routes/order"));

//start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`server is running on PORT: ${PORT}`);
});
