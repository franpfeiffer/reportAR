import "server-only";
import { noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { categoryLabels, type Category } from "./validation";
import type { ReportUrgency, UrgencyClassificationStatus } from "@reportar/db/schema";

const URGENT_THRESHOLD = 0.7;
const NOT_URGENT_THRESHOLD = 0.3;

export type ClassificationDecision = {
  declaredCategory: Category;
  urgency: ReportUrgency | null;
  suggestedUrgency: ReportUrgency | null;
  urgentProbability: number | null;
  urgencyClassificationStatus: UrgencyClassificationStatus;
  urgencyClassificationModel: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function unavailableClassification(declaredCategory: Category): ClassificationDecision {
  return {
    declaredCategory,
    urgency: null,
    suggestedUrgency: null,
    urgentProbability: null,
    urgencyClassificationStatus: "UNAVAILABLE",
    urgencyClassificationModel: null,
  };
}

export function decideClassification(declaredCategory: Category, response: unknown): ClassificationDecision {
  if (!isRecord(response) || typeof response.model !== "string" || !response.model.trim() || !isRecord(response.answers)) {
    return unavailableClassification(declaredCategory);
  }
  const answer = response.answers.urgent_repair;
  if (!isRecord(answer) || typeof answer.noul !== "number" || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) {
    return unavailableClassification(declaredCategory);
  }

  const urgentProbability = answer.noul;
  const suggestedUrgency: ReportUrgency = urgentProbability >= 0.5 ? "URGENTE" : "NO_URGENTE";
  const urgency = urgentProbability >= URGENT_THRESHOLD
    ? "URGENTE"
    : urgentProbability <= NOT_URGENT_THRESHOLD
      ? "NO_URGENTE"
      : null;
  return {
    declaredCategory,
    urgency,
    suggestedUrgency,
    urgentProbability,
    urgencyClassificationStatus: urgency ? "AUTO_ASSIGNED" : "NEEDS_REVIEW",
    urgencyClassificationModel: response.model,
  };
}

export async function classifyReport(description: string, declaredCategory: Category): Promise<ClassificationDecision> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) return unavailableClassification(declaredCategory);

  try {
    const client = new TypeSafeClient({
      apiKey,
      defaultModel: "jev-latest",
      timeout: 8_000,
      retry: { maxRetries: 0 },
      logLevel: "off",
    });
    const response = await client.systemOne({
      state: {
        report: {
          description,
          declared_category: categoryLabels[declaredCategory],
        },
      },
      questions: {
        urgent_repair: noul(
          "¿El reporte en `report.description`, leído junto con `report.declared_category`, indica que la reparación requiere atención urgente?",
          {
            true: "Hay señales explícitas de peligro inmediato para personas o salud, riesgo de accidente, daños graves en curso, bloqueo de acceso o interrupción significativa de un servicio esencial. La reparación debería priorizarse de inmediato.",
            false: "Es mantenimiento rutinario, deterioro menor o una molestia sin peligro inmediato, daños graves en curso ni interrupción significativa de un servicio esencial. Puede atenderse mediante la planificación normal.",
          },
        ),
      },
    });
    return decideClassification(declaredCategory, response);
  } catch (error) {
    console.error("Jev report classification failed", {
      errorName: isRecord(error) && typeof error.name === "string" ? error.name : "UnknownError",
    });
    return unavailableClassification(declaredCategory);
  }
}
