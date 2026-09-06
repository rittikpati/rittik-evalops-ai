import { handlers } from "@/lib/auth";

/**
 * CRITICAL (Next.js 16): GET route handlers are cached by the Data Cache by
 * default. Auth responses depend on the requesting user's session cookie, so
 * caching here would leak one user's session to every other user. force-dynamic
 * is required for correctness and security.
 */
export const dynamic = "force-dynamic";

export const { GET, POST } = handlers;
