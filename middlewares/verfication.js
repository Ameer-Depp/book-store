const jwt = require("jsonwebtoken");
function verifyToken(req, res, next) {
  const token = req.cookies.token; // <-- read token from cookie

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, isAdmin }
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function verifyTokenAndAuthorization(req, res, next) {
  verifyToken(req, res, () => {
    if (!req.params.id) {
      return next();
    }

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

const isAdmin = (req, res, next) => {
  if (req.user?.isAdmin) {
    next();
  } else {
    res.status(403).json({ message: "Admin access required" });
  }
};

module.exports = {
  verifyToken,
  verifyTokenAndAuthorization,
  isAdmin,
};
