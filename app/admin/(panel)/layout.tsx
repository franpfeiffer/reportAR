import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "./logout-button";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-[#14433F] text-white">
        <div className="admin-shell flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Brand inverse />
            <span className="hidden border-l border-white/25 pl-3 text-sm text-[#C5E0D4] sm:inline">Panel municipal</span>
          </div>
          <div className="flex items-center gap-3"><ThemeToggle inverse /><LogoutButton /></div>
        </div>
      </header>
      {children}
    </div>
  );
}
