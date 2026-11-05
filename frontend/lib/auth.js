import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = "ecobuild_session";

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Copy .env.example to .env.local and fill it in."
  );
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signSession(user) {
  // Only non-sensitive fields go in the token payload.
  return jwt.sign(
    { userId: user.user_id, name: user.name, role: user.role_name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifySession(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function setSessionCookie(token) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export function getSessionFromCookies() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

// Check whether the current session has one of the allowed roles.
export function requireRole(allowed) {
  const session = getSessionFromCookies();

  // User is not logged in.
  if (!session) {
    return {
      session: null,
      error: "Login required",
      status: 401,
    };
  }

  const allowedRoles = Array.isArray(allowed)
    ? allowed
    : [allowed];

  // User is logged in but does not have permission.
  if (!allowedRoles.includes(session.role)) {
    return {
      session: null,
      error: "Forbidden: insufficient permissions",
      status: 403,
    };
  }

  // User is authenticated and authorized.
  return {
    session,
    error: null,
    status: 200,
  };
}
