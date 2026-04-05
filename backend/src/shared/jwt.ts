import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";

export interface JwtUserPayload {
  sub: string;
  email: string;
  role: string;
}

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_SECRET is required");
  }

  return value;
}

function refreshSecret(): string {
  const value = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET;
  if (!value) {
    throw new Error("JWT_REFRESH_SECRET is required");
  }

  return value;
}

export function signAccessToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, refreshSecret(), { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyAccessToken(token: string): JwtUserPayload {
  return jwt.verify(token, secret()) as JwtUserPayload;
}

export function verifyRefreshToken(token: string): JwtUserPayload {
  return jwt.verify(token, refreshSecret()) as JwtUserPayload;
}
