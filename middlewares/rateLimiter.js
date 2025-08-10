const client = require("../config/redis");

const rateLimiter = async (req, res, next) => {
  const identifier =
    req.user?.userId ||
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip ||
    "unknown";

  const routePath = req.path;

  const routeLimits = {
    "/api/auth/login": { window: 60, max: 5 },
    "/api/code/redeem": { window: 3600, max: 3 },
  };

  let window = 60;
  let max = req.user ? 100 : 10;

  if (routeLimits[routePath]) {
    window = routeLimits[routePath].window;
    max = routeLimits[routePath].max;
  }

  try {
    const key = `rate_limit:${routePath}:${identifier}`;
    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, window);
    }

    const ttl = await client.ttl(key);
    if (ttl === -1) {
      await client.expire(key, window);
    }

    if (count > max) {
      return res.status(429).json({
        message: `Too many requests. Limit: ${max}/${window}s. Try again in ${
          ttl > 0 ? ttl : window
        }s.`,
        retryAfter: ttl > 0 ? ttl : window,
        current: count,
        limit: max,
      });
    }

    res.set({
      "X-RateLimit-Limit": max,
      "X-RateLimit-Remaining": Math.max(0, max - count),
      "X-RateLimit-Reset":
        Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : window),
    });

    next();
  } catch (err) {
    console.error("Rate limiter error:", err);
    next();
  }
};

module.exports = rateLimiter;
