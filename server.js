const express = require("express");
const dotenv = require("dotenv");
const { dbConnection } = require("./config/db");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const setupSwagger = require("./swagger");

// Load env variables
dotenv.config();

// Connect to database
dbConnection();

// Initialize app
const app = express();

// Middlewares
app.use(express.json());
app.use(morgan("dev"));
app.use(helmet());
app.use(cors());
setupSwagger(app);

// Health check
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/category", require("./routes/category"));
app.use("/api/book", require("./routes/book"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/order", require("./routes/order"));

// 404 Not Found
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on PORT: ${PORT}`);
});
