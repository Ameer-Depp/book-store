const express = require("express");
const dotenv = require("dotenv");
const { dbConnection } = require("./config/db");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const setupSwagger = require("./swagger");
const cookieParser = require("cookie-parser");
const rateLimiter = require("./middlewares/rateLimiter");

dotenv.config();

require("./config/redis");

dbConnection();

const app = express();

app.set("trust proxy", true);

app.use(helmet());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use(morgan("dev"));

app.use(rateLimiter);

setupSwagger(app);

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/category", require("./routes/category"));
app.use("/api/book", require("./routes/book"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/order", require("./routes/order"));
app.use("/api/code", require("./routes/code"));

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on PORT: ${PORT}`);
});
