"use client";

import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();

export type OAuthProvider = "google" | "vercel";

export async function signInWithProvider(provider: OAuthProvider, callbackURL: string) {
  return authClient.signIn.social({ provider, callbackURL });
}

export async function logout() {
  return authClient.signOut();
}
