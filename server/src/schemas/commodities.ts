import { z } from "zod";

import { categorySchema } from "./shared";

export const commodityQuerySchema = z.object({
  category: categorySchema.optional(),
});

export type Commodity = {
  id: string;
  name: string;
  category: string;
};
