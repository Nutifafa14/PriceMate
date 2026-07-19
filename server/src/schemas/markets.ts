import { z } from "zod";

export const marketQuerySchema = z.object({
  region: z.string().trim().min(1).optional(),
});

export type Market = {
  id: string;
  name: string;
  region: string;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
};
