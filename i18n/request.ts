import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const SUPPORTED_LOCALES = ["en", "es"];

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const stored = cookieStore.get("locale")?.value;
  const locale = stored && SUPPORTED_LOCALES.includes(stored) ? stored : "en";

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
