import { Zap } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function GpuPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">GPU Monitoring</h1>
      <EmptyState
        icon={Zap}
        title="Coming soon"
        description="Real-time GPU utilization, VRAM usage, and temperature monitoring will be available when a GPU agent is connected."
        className="mt-12"
      />
    </div>
  );
}
