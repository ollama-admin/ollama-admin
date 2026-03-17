import { MessageSquare, Wrench, Eye, Layers, Zap, Code } from "lucide-react";

const CAP_ICONS: Record<string, React.ReactNode> = {
  text:      <MessageSquare className="h-3.5 w-3.5" />,
  tools:     <Wrench className="h-3.5 w-3.5" />,
  vision:    <Eye    className="h-3.5 w-3.5" />,
  embedding: <Layers className="h-3.5 w-3.5" />,
  thinking:  <Zap    className="h-3.5 w-3.5" />,
  code:      <Code   className="h-3.5 w-3.5" />,
};

const CAP_COLORS: Record<string, string> = {
  text:      "hsl(var(--muted-foreground))",
  tools:     "hsl(38 92% 50%)",
  vision:    "hsl(217 91% 60%)",
  embedding: "hsl(271 81% 56%)",
  thinking:  "hsl(142 71% 45%)",
  code:      "hsl(25 95% 53%)",
};

export function CapabilityIcons({ capabilities }: { capabilities: string[] }) {
  if (capabilities.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {capabilities.map((cap) => (
        <span key={cap} title={cap} style={{ color: CAP_COLORS[cap] ?? "hsl(var(--muted-foreground))" }}>
          {CAP_ICONS[cap] ?? null}
        </span>
      ))}
    </div>
  );
}

export { CAP_ICONS, CAP_COLORS };
