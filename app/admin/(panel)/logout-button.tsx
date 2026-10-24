"use client";

import { useState } from "react";
import { logout } from "@reportar/auth/client";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    const result = await logout();
    if (!result.error) window.location.assign("/admin/login");
    else setBusy(false);
  }

  return (
    <button onClick={() => void handleLogout()} disabled={busy} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60">
      {busy ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}
