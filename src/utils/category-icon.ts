import type { Ionicons } from "@expo/vector-icons";

import type { Category } from "@/types";

type IconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_ICON: Record<Category, IconName> = {
  "cereals and tubers": "basket-outline",
  "vegetables and fruits": "leaf-outline",
  "meat, fish and eggs": "fish-outline",
  "pulses and nuts": "nutrition-outline",
};

export function categoryIcon(category: Category): IconName {
  return CATEGORY_ICON[category];
}
