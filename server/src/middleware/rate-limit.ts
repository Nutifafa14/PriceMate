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

/**
 * POST /api/predictions fans out to the ML API plus two external signal
 * APIs (World Bank, currency-api) per call — those are cheap and cached,
 * but this cap keeps one client from hammering the endpoint regardless.
 * 30/15min comfortably covers real usage (nobody re-forecasts the same
 * commodity that often) while leaving headroom above the server test
 * suite's real calls against this route.
 */
export const predictionsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many prediction requests. Try again later." },
});
