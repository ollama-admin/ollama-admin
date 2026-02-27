import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function MetricsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Metrics</h1>
      <EmptyState
        icon={BarChart3}
        title="Coming soon"
        description="Token usage analytics, latency trends, and model performance metrics will be available in a future release."
        className="mt-12"
      />
    </div>
  );
}
