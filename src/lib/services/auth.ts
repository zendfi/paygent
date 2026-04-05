import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createSessionToken } from "@/lib/auth/session";
import { readStore, writeStore } from "@/lib/storage/store";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string): string {
  const salt = randomUUID().replaceAll("-", "");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, hash] = passwordHash.split(":");
  if (!salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  if (stored.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(derived, stored);
}

export async function registerOwnerUser(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const password = input.password.trim();

  if (!email || !password || password.length < 8) {
    throw new Error("email_and_password_minimum_requirements_not_met");
  }

  const store = await readStore();
  const users = store.authUsers ?? [];
  const exists = users.some((user) => normalizeEmail(user.email) === email);
  if (exists) {
    throw new Error("email_already_registered");
  }

  const timestamp = new Date().toISOString();
  users.push({
    id: `usr_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
    email,
    passwordHash: hashPassword(password),
    role: "owner",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  store.authUsers = users;

  await writeStore(store);
  return { email };
}

export async function authenticateOwnerUser(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const password = input.password.trim();

  if (!email || !password) {
    throw new Error("email_and_password_required");
  }

  const store = await readStore();
  const users = store.authUsers ?? [];
  const user = users.find((item) => normalizeEmail(item.email) === email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("invalid_credentials");
  }

  user.lastLoginAt = new Date().toISOString();
  user.updatedAt = new Date().toISOString();
  await writeStore(store);

  const sessionToken = await createSessionToken(user.email);
  return { email: user.email, sessionToken };
}
