import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type AuthRole = "admin" | "member";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
}

export interface OAuthProfile {
  provider: string;
  providerAccountId: string;
  email: string;
  name: string;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const sep = stored.indexOf(":");
  if (sep === -1) return false;
  const salt = stored.slice(0, sep);
  const hash = stored.slice(sep + 1);
  try {
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, salt, 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** Validates credentials against the database. Returns the user on success, null otherwise. */
export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  // OAuth-only accounts have no password hash â€” they cannot use password sign-in.
  if (!row.passwordHash) return null;
  if (!verifyPassword(password, row.passwordHash)) return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

/** Looks up a user by id (used to re-validate sessions against the store). */
export async function getUserById(id: string): Promise<SessionUser | null> {
  const cached = userCache.get(id);
  if (cached && cached.expiresAt > Date.now()) return cached.user;
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (rows.length === 0) return null;
  const user = { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role };
  userCache.set(id, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  return user;
}

/**
 * Short positive-only cache for session re-validation. Every authenticated API
 * call resolved the session via a Supabase round-trip (`getUserById`); with it
 * cached, page loads hit the DB once per write instead of once per request.
 * Removed/deleted users still get logged out within the TTL (30s).
 */
const USER_CACHE_TTL_MS = 30_000;
const userCache = new Map<string, { user: SessionUser; expiresAt: number }>();

/** Drops a cached user so the next read reflects the latest write. */
export function invalidateUserCache(id: string): void {
  userCache.delete(id);
}

/** Returns true when any account is already registered with this (normalized) email. */
export async function emailExists(email: string): Promise<boolean> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  return rows.length > 0;
}

/** Updates name/email only. Password and role are never touched by profile updates. */
export async function updateUserProfile(
  id: string,
  patch: { name?: string; email?: string }
): Promise<SessionUser | null> {
  const db = getDb();
  const values: { name?: string; email?: string } = {};
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.email !== undefined) values.email = patch.email.trim().toLowerCase();
  if (Object.keys(values).length === 0) return getUserById(id);

  const rows = await db
    .update(users)
    .set(values)
    .where(eq(users.id, id))
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
  if (rows.length === 0) return null;
  invalidateUserCache(id);
  return { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role };
}

/**
 * Finds the user linked to an OAuth provider account, or creates a new one.
 *
 * Lookup order:
 *   1. By (provider, providerAccountId) â€” the same federated identity.
 *   2. By email â€” links a federated account onto an existing password user.
 *   3. Otherwise creates a brand-new OAuth-only account.
 *
 * Returns null only when a matching email belongs to a different provider's
 * account (a genuine collision that must not be auto-linked), letting the
 * caller surface the conflict instead of silently escalating privilege.
 */
export async function findOrCreateOAuthUser(profile: OAuthProfile): Promise<SessionUser | null> {
  const db = getDb();
  const email = profile.email.trim().toLowerCase();

  // 1. Existing federated identity.
  const byAccount = await db
    .select()
    .from(users)
    .where(and(eq(users.provider, profile.provider), eq(users.providerAccountId, profile.providerAccountId)))
    .limit(1);
  if (byAccount.length > 0) {
    return { id: byAccount[0].id, name: byAccount[0].name, email: byAccount[0].email, role: byAccount[0].role };
  }

  // 2. Existing account with the same email â€” link identity onto it.
  const byEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (byEmail.length > 0) {
    const existing = byEmail[0];
    // Refuse to link onto a different provider's account â€” potential hijack.
    if (existing.provider && existing.provider !== profile.provider) return null;
    const linked = await db
      .update(users)
      .set({
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        ...(existing.name ? {} : { name: profile.name }),
      })
      .where(eq(users.id, existing.id))
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
    if (linked.length === 0) return null;
    invalidateUserCache(existing.id);
    return { id: linked[0].id, name: linked[0].name, email: linked[0].email, role: linked[0].role };
  }

  // 3. Brand-new OAuth-only account.
  const [created] = await db
    .insert(users)
    .values({
      id: `user_${randomUUID().slice(0, 12)}`,
      name: profile.name?.trim() || email.split("@")[0] || "User",
      email,
      role: "member",
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
    })
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
  if (!created) return null;
  return { id: created.id, name: created.name, email: created.email, role: created.role };
}
