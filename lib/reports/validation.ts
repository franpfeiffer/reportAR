export const categoryLabels = {
  BACHE: "Bache o vereda rota", INUNDACION: "Inundación", ALUMBRADO: "Alumbrado público", BASURA: "Basura o limpieza",
  ARBOLADO: "Árboles y espacios verdes", OTRO: "Otro problema",
} as const;
export const urgencyLabels = { URGENTE: "Urgente", NO_URGENTE: "No urgente" } as const;
export const statusLabels = { RECIBIDO: "Recibido", EN_REVISION: "En revisión", RESUELTO: "Resuelto" } as const;
export type Category = keyof typeof categoryLabels;
export type Urgency = keyof typeof urgencyLabels;
export type ReportStatus = keyof typeof statusLabels;
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export class ValidationError extends Error {}
export function parseReport(value: unknown) {
  if (!isRecord(value)) throw new ValidationError("El formulario no tiene un formato válido.");
  const category = value.category;
  const address = typeof value.address === "string" ? value.address.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  if (typeof category !== "string" || !Object.hasOwn(categoryLabels, category)) throw new ValidationError("Elegí una categoría válida.");
  if (!address) throw new ValidationError("Indicá una ubicación o referencia.");
  if (!description) throw new ValidationError("Describí la situación.");
  const latitude = value.latitude ?? null;
  const longitude = value.longitude ?? null;
  if (latitude !== null || longitude !== null) {
    if (typeof latitude !== "number" || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        typeof longitude !== "number" || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      throw new ValidationError("La ubicación del mapa no es válida.");
    }
  }
  return { category: category as Category, address, description, latitude: latitude as number | null, longitude: longitude as number | null };
}
