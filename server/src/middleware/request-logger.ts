import type { NextFunction, Request, Response } from "express";

import { env } from "../env";

/** Minimal structured request logging — no morgan/pino needed for this scale. Silent during tests. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (env.nodeEnv === "test") {
    next();
    return;
  }

  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
}
