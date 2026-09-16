// Centralized password policy + hashing (bcryptjs, cost 12).
// Single definition of the "8+ upper/lower/digit" rule previously
// copy-pasted across auth.ts (×3) and users.ts.

import bcrypt from "bcryptjs";
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, "must contain an uppercase letter")
  .regex(/[a-z]/, "must contain a lowercase letter")
  .regex(/[0-9]/, "must contain a digit");

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
