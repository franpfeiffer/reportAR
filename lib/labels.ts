export const categoryLabels = {
  BACHE: "Bache o vereda rota", INUNDACION: "Inundación", ALUMBRADO: "Alumbrado público", BASURA: "Basura o limpieza",
  ARBOLADO: "Árboles y espacios verdes", OTRO: "Otro problema",
} as const;
export const urgencyLabels = { URGENTE: "Urgente", NO_URGENTE: "No urgente" } as const;
export const statusLabels = { RECIBIDO: "Recibido", EN_REVISION: "En revisión", RESUELTO: "Resuelto" } as const;
export type Category = keyof typeof categoryLabels;
export type Urgency = keyof typeof urgencyLabels;
export type ReportStatus = keyof typeof statusLabels;
export type UrgencyClassificationStatus = "AUTO_ASSIGNED" | "NEEDS_REVIEW" | "UNAVAILABLE" | "REVIEWED";
