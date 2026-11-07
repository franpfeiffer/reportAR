"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { logout } from "@reportar/auth/client";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    const result = await logout();
    if (!result.error) { router.replace("/admin/login"); router.refresh(); }
    else setBusy(false);
  }

  return (
    <button onClick={() => void handleLogout()} disabled={busy} className="rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-60">
      {busy ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}
