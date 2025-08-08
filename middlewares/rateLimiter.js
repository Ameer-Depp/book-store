const client = require("../config/redis");

const rateLimiter = async (req, res, next) => {
  const identifier =
    req.user?.userId ||
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip ||
    "unknown";

  console.log("Rate limiting for identifier:", identifier);

  const routePath = req.path;
  console.log("Route path:", routePath);

  const routeLimits = {
    "/api/auth/login": { window: 60, max: 5 },
    "/api/code/redeem": { window: 3600, max: 3 },
  };

  const { window = 60, max = 10 } = routeLimits[routePath] || {};

  console.log(`Limit for ${routePath}: ${max} requests per ${window}s`);

  try {
    const key = `rate_limit:${routePath}:${identifier}`;
    console.log("Redis key:", key);

    const count = await client.incr(key);
    console.log("Current count:", count);

    if (count === 1) {
      await client.expire(key, window);
    }

    const ttl = await client.ttl(key);
    console.log("TTL:", ttl);

    if (count > max) {
      console.log(`RATE LIMITED! ${count} > ${max}`);
      return res.status(429).json({
        message: `Too many requests. Limit: ${max}/${window}s. Try again in ${ttl}s.`,
        retryAfter: ttl,
        current: count,
        limit: max,
      });
    }

    res.set({
      "X-RateLimit-Limit": max,
      "X-RateLimit-Remaining": Math.max(0, max - count),
      "X-RateLimit-Reset": Math.floor(Date.now() / 1000) + ttl,
    });

    next();
  } catch (err) {
    console.error("Rate limiter error:", err);
    next();
  }
};

module.exports = rateLimiter;
