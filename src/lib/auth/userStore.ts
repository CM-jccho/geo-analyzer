import crypto from "node:crypto";
import { kvAvailable, kvGet, kvSet } from "../kv";

// 사용자 저장소. KV 있으면 영속, 없으면 인메모리(같은 인스턴스).
// 비밀번호는 scrypt로 해시(솔트별). 평문 저장 안 함.

export interface User {
  email: string;
  salt: string;
  hash: string;
  plan: string;
  createdAt: string;
}

const mem: Map<string, User> = (globalThis as any).__geoUsers ?? new Map();
(globalThis as any).__geoUsers = mem;

function hashPw(pw: string, salt: string): string {
  return crypto.scryptSync(pw, salt, 64).toString("hex");
}

export async function getUser(email: string): Promise<User | null> {
  const key = email.toLowerCase();
  const local = mem.get(key);
  if (local) return local;
  if (kvAvailable()) {
    try {
      const v = await kvGet(`geo:user:${key}`);
      if (v) {
        const u = JSON.parse(v) as User;
        mem.set(key, u);
        return u;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function createUser(email: string, password: string): Promise<User> {
  const key = email.toLowerCase();
  const salt = crypto.randomBytes(16).toString("hex");
  const user: User = { email: key, salt, hash: hashPw(password, salt), plan: "free", createdAt: new Date().toISOString() };
  mem.set(key, user);
  if (kvAvailable()) {
    try {
      await kvSet(`geo:user:${key}`, JSON.stringify(user));
    } catch {
      /* ignore */
    }
  }
  return user;
}

export function verifyPassword(user: User, password: string): boolean {
  const candidate = Buffer.from(hashPw(password, user.salt));
  const stored = Buffer.from(user.hash);
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}
