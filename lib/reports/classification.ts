import "server-only";
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { categoryLabels, type Category } from "./validation";
import type { ClassificationStatus } from "@reportar/db/schema";

const AUTO_ASSIGN_MIN_PROBABILITY = 0.7;
const modelOptions = {
  street_damage: "Baches, pozos y veredas rotas.",
  flooding: "Inundaciones y acumulación de agua en calles o espacios públicos.",
  public_lighting: "Luminarias públicas apagadas, rotas o con fallas.",
  waste_and_cleanliness: "Basura, residuos, limpieza urbana o contenedores.",
  trees_and_green_spaces: "Árboles, arbolado, plazas y otros espacios verdes.",
  other_municipal_issue: "Otro problema urbano que no encaja en las categorías anteriores.",
} as const;

const categoryByOption = {
  street_damage: "BACHE",
  flooding: "INUNDACION",
  public_lighting: "ALUMBRADO",
  waste_and_cleanliness: "BASURA",
  trees_and_green_spaces: "ARBOLADO",
  other_municipal_issue: "OTRO",
} as const satisfies Record<keyof typeof modelOptions, Category>;

type Option = keyof typeof modelOptions;

export type ClassificationDecision = {
  category: Category;
  declaredCategory: Category;
  suggestedCategory: Category | null;
  classificationProbability: number | null;
  classificationStatus: ClassificationStatus;
  classificationModel: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function unavailableClassification(declaredCategory: Category): ClassificationDecision {
  return {
    category: declaredCategory,
    declaredCategory,
    suggestedCategory: null,
    classificationProbability: null,
    classificationStatus: "UNAVAILABLE",
    classificationModel: null,
  };
}

export function decideClassification(declaredCategory: Category, response: unknown): ClassificationDecision {
  if (!isRecord(response) || typeof response.model !== "string" || !response.model.trim() || !isRecord(response.answers)) {
    return unavailableClassification(declaredCategory);
  }
  const answer = response.answers.category;
  if (!isRecord(answer) || typeof answer.choice !== "string" || !Object.hasOwn(categoryByOption, answer.choice) || !isRecord(answer.probabilities)) {
    return unavailableClassification(declaredCategory);
  }

  const choiceOption = answer.choice as Option;
  const options = Object.keys(modelOptions) as Option[];
  const probabilities: number[] = [];
  for (const option of options) {
    const probability = answer.probabilities[option];
    if (typeof probability !== "number" || !Number.isFinite(probability) || probability < 0 || probability > 1) {
      return unavailableClassification(declaredCategory);
    }
    probabilities.push(probability);
  }
  const total = probabilities.reduce((sum, probability) => sum + probability, 0);
  if (Math.abs(total - 1) > 0.02) return unavailableClassification(declaredCategory);

  const selectedProbability = answer.probabilities[choiceOption] as number;
  if (selectedProbability + 1e-9 < Math.max(...probabilities)) return unavailableClassification(declaredCategory);

  const suggestedCategory = categoryByOption[choiceOption];
  const autoAssigned = selectedProbability >= AUTO_ASSIGN_MIN_PROBABILITY;
  return {
    category: autoAssigned ? suggestedCategory : declaredCategory,
    declaredCategory,
    suggestedCategory,
    classificationProbability: selectedProbability,
    classificationStatus: autoAssigned ? "AUTO_ASSIGNED" : "NEEDS_REVIEW",
    classificationModel: response.model,
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
        category: choice(
          "¿Qué categoría describe mejor el problema municipal en `report.description`? Usá `report.declared_category` como contexto.",
          modelOptions,
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
