import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const t = useTranslations("settings");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
    </div>
  );
}
