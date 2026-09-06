import NextAuth from "next-auth";
import type { OIDCConfig } from "next-auth/providers";
import { cookies } from "next/headers";
import { findOrCreateOAuthUser } from "@/lib/auth/users";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession } from "@/lib/auth/token";

/** Generic OIDC/SSO provider, enabled only when the required env is present. */
function oidcProvider(): OIDCConfig<Record<string, unknown>> | null {
  const issuer = process.env.AUTH_OIDC_ISSUER?.trim();
  const clientId = process.env.AUTH_OIDC_CLIENT_ID?.trim();
  const clientSecret = process.env.AUTH_OIDC_CLIENT_SECRET?.trim();
  if (!issuer || !clientId || !clientSecret) return null;

  return {
    id: "oidc",
    name: "SSO / OIDC",
    type: "oidc",
    issuer,
    clientId,
    clientSecret,
    wellKnown: issuer.replace(/\/$/, "") + "/.well-known/openid-configuration",
    profile(profile) {
      const email = typeof profile.email === "string" ? profile.email : "";
      const name = typeof profile.name === "string" ? profile.name : email;
      const picture = typeof profile.picture === "string" ? profile.picture : null;
      return {
        id: String(profile.sub ?? email),
        name: name || email || "User",
        email: email || "",
        image: picture,
      };
    },
  };
}

const providers = [oidcProvider()].filter(Boolean) as Array<
  NonNullable<ReturnType<typeof oidcProvider>>
>;

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Only OAuth/OIDC accounts flow through here; password auth is handled
      // by the existing /api/auth/login route, not Auth.js.
      if (!account || (account.type !== "oauth" && account.type !== "oidc")) return true;
      const provider = account.provider;
      const providerAccountId = user.id ?? account.providerAccountId;
      const email = user.email?.trim()?.toLowerCase();
      if (!email || !providerAccountId) return false;

      const appUser = await findOrCreateOAuthUser({
        provider,
        providerAccountId: String(providerAccountId),
        email,
        name: user.name ?? email.split("@")[0] ?? "User",
      });
      if (!appUser) return false;

      // Mint the existing stateless HMAC session cookie so requireCurrentUser
      // and every existing protected route continue to work unchanged.
      const secure =
        process.env.NODE_ENV === "production" ||
        (process.env.AUTH_URL?.startsWith("https://") ?? false) ||
        (process.env.NEXTAUTH_URL?.startsWith("https://") ?? false);
      const token = signSession({ id: appUser.id, email: appUser.email, name: appUser.name, role: appUser.role });
      (await cookies()).set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
      });

      return true;
    },
  },
});
