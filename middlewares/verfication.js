const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user payload
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function verifyTokenAndAuthorization(req, res, next) {
  verifyToken(req, res, () => {
    if (
      req.user.userId.toString() === req.params.id.toString() ||
      req.user.isAdmin
    ) {
      next();
    } else {
      res.status(403).json({ message: "Unauthorized access" });
    }
  });
}

// Admin-only middleware (reuse verifyToken first)
const isAdmin = (req, res, next) => {
  if (req.user?.isAdmin) next();
  else res.status(403).json({ message: "Admin access required" });
};

module.exports = { verifyToken, verifyTokenAndAuthorization, isAdmin };
