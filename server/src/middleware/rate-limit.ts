import rateLimit from "express-rate-limit";

/**
 * Sign-in/sign-up are brute-force targets — cap attempts per IP. The full
 * auth test suite makes ~11 requests in one run against a shared app
 * instance, so 50/15min has real headroom above that while still being a
 * meaningful production limit (tune per-route if this ever needs to be
 * stricter for sign-in specifically).
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again later." },
});
