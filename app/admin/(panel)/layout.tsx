import { requireMunicipalAdmin } from "@reportar/auth";
import { connection } from "next/server";

export const instant = false;

export default async function MunicipalPanelLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  await requireMunicipalAdmin();
  return children;
}
