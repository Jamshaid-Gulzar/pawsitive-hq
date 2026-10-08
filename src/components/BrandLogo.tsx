import { getBusiness } from "@/db/business";
import { Logo } from "./ui";

/** The logo and business name the admin set in Settings. */
export async function BrandLogo({ dark = false, small = false }: { dark?: boolean; small?: boolean }) {
  const b = await getBusiness();
  return <Logo dark={dark} small={small} name={b.name} logo={b.logo} />;
}
