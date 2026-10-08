import { eq } from "drizzle-orm";
import { cache } from "react";
import { parseBusiness, type BusinessInfo } from "@/lib/business";
import { getDb } from ".";
import { settings } from "./schema";

/** The clinic's details from Settings (cached for one request). */
export const getBusiness = cache(async (): Promise<BusinessInfo> => {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, "business"));
  return parseBusiness(row?.value);
});
