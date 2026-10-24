import { createNeonAuth } from "@neondatabase/auth/next/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "./db";
import { userProfiles, type UserProfile } from "./schema";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});

export async function getCurrentUser() {
  const { data, error } = await auth.getSession();
  if (error) return null;
  return data?.user ?? null;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  await db.insert(userProfiles).values({
    authUserId: user.id,
    email: user.email ?? "",
    name: user.name ?? "",
  }).onConflictDoUpdate({
    target: userProfiles.authUserId,
    set: {
      email: user.email ?? "",
      name: user.name ?? "",
      updatedAt: new Date(),
    },
  });

  const [profile] = await db.select().from(userProfiles)
    .where(eq(userProfiles.authUserId, user.id)).limit(1);

  return profile ?? null;
}

export async function requireMunicipalAdmin(): Promise<UserProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/admin/login");
  if (profile.role !== "MUNICIPAL_ADMIN") redirect("/admin/login?error=not-admin");
  return profile;
}

export async function isMunicipalAdmin(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === "MUNICIPAL_ADMIN";
}

