import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../env";
import { unauthorized } from "../lib/http-error";

export type AuthedRequest = Request & { userId?: string };

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(unauthorized("Missing bearer token"));
    return;
  }

  try {
    const payload = jwt.verify(header.slice("Bearer ".length), env.jwtSecret) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    next(unauthorized("Invalid or expired token"));
  }
}
