import { useTranslations } from "next-intl";

export default function ChatConversationPage({
  params,
}: {
  params: { id: string };
}) {
  const t = useTranslations("chat");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-[hsl(var(--muted-foreground))]">
        Conversation {params.id}
      </p>
    </div>
  );
}
