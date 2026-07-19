import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";

import { env } from "../env";
import { pool } from "../db/pool";
import { asyncHandler } from "../lib/async-handler";
import { conflict, notFound, unauthorized } from "../lib/http-error";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { signInSchema, signUpSchema } from "../schemas/auth";

export const authRouter = Router();

const SALT_ROUNDS = 10;
const TOKEN_TTL = "30d";

function issueToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: TOKEN_TTL });
}

authRouter.post(
  "/sign-up",
  asyncHandler(async (req, res) => {
    const { name, email, password } = signUpSchema.parse(req.body);

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount) {
      throw conflict("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query<{ id: string; name: string; email: string }>(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, passwordHash],
    );
    const user = rows[0];

    res.status(201).json({ user, token: issueToken(user.id) });
  }),
);

authRouter.post(
  "/sign-in",
  asyncHandler(async (req, res) => {
    const { email, password } = signInSchema.parse(req.body);

    const { rows } = await pool.query<{ id: string; name: string; email: string; password_hash: string }>(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [email],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw unauthorized("Invalid email or password");
    }

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      token: issueToken(user.id),
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await pool.query<{ id: string; name: string; email: string }>(
      "SELECT id, name, email FROM users WHERE id = $1",
      [req.userId],
    );
    if (!rows[0]) {
      throw notFound("User");
    }
    res.json({ user: rows[0] });
  }),
);
