import { auth } from "@reportar/auth";

export default auth.middleware({ loginUrl: "/admin/login" });

export const config = {
  matcher: ["/admin", "/admin/((?!login(?:/|$)).*)"],
};
