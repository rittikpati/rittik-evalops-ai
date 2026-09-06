export { proxy } from "@/backend/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/datasets/:path*",
    "/experiments/:path*",
    "/models/:path*",
    "/prompts/:path*",
    "/analytics/:path*",
    "/comparison/:path*",
    "/evaluations/:path*",
    "/settings/:path*",
    "/runs/:path*",
    "/api/:path*",
  ],
};