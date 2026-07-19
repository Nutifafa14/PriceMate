import { z } from "zod";

// Mirrors app/src/utils/validation.ts's signInSchema/signUpSchema shape.
// Kept independent (separate workspace, no shared package) but must stay
// aligned if either side's rules change.

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type SignInInput = z.infer<typeof signInSchema>;
