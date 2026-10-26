import type { Category } from "@/lib/reports/validation";
export const categoryColors: Record<Category, string> = { BACHE: "#C76338", INUNDACION: "#327FA6", ALUMBRADO: "#AD821C", BASURA: "#377A75", ARBOLADO: "#53843B", OTRO: "#806C9E" };
export const shortCategory: Record<Category, string> = { BACHE: "Calles y veredas", INUNDACION: "Inundaciones", ALUMBRADO: "Alumbrado", BASURA: "Limpieza", ARBOLADO: "Arbolado", OTRO: "Otros" };
export function CategoryIcon({ category, size = 20 }: { category: Category; size?: number }) {
  const paths: Record<Category, React.ReactNode> = {
    BACHE: <><path d="m7 3-3 18M17 3l3 18M12 3v4m0 4v3m0 4v3" /></>,
    INUNDACION: <><path d="M12 2c-2 3-6 7-6 11a6 6 0 0 0 12 0c0-4-4-8-6-11ZM3 21c2-2 4 2 6 0s4 2 6 0 4 2 6 0" /></>,
    ALUMBRADO: <><path d="M9 18h6m-5 3h4M9 15c0-3-3-3-3-7a6 6 0 0 1 12 0c0 4-3 4-3 7Z" /></>,
    BASURA: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></>,
    ARBOLADO: <><path d="M12 22v-7m0 2-4-3m4 1 4-3M7 18a4 4 0 0 1-3-7 5 5 0 0 1 3-7 5 5 0 0 1 10 0 5 5 0 0 1 3 7 4 4 0 0 1-3 7" /></>,
    OTRO: <><path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v.5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[category]}</svg>;
}
export function MapIcon({ kind, size = 20 }: { kind: "pin" | "search" | "arrow" | "close" | "photo" | "layers" | "check"; size?: number }) {
  const paths = {
    pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    photo: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></>,
    layers: <><path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
