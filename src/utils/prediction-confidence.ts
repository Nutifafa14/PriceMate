import type { Category } from "@/types";

/**
 * Sourced directly from ml/reports/MODEL_EVALUATION.md §5's per-category
 * MAPE on the held-out test set (not invented) — the report explicitly
 * flagged surfacing this to users as a Phase 5/6 decision. Update these
 * labels if the model is retrained and the report's numbers change.
 */
const CATEGORY_CONFIDENCE: Record<Category, { label: string; tone: "success" | "neutral" | "danger" }> = {
  "cereals and tubers": { label: "Typically reliable (~38% average error)", tone: "success" },
  "pulses and nuts": { label: "Typically reliable (~37% average error)", tone: "success" },
  "meat, fish and eggs": { label: "Moderately reliable (~50% average error)", tone: "neutral" },
  "vegetables and fruits": {
    label: "Less reliable — fresh produce prices are volatile (~100%+ average error)",
    tone: "danger",
  },
};

export function predictionConfidence(category: Category) {
  return CATEGORY_CONFIDENCE[category];
}
