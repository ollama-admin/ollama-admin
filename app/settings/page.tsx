import { Settings } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <EmptyState
        icon={Settings}
        title="Coming soon"
        description="Application preferences, authentication settings, and log retention configuration will be available in a future release."
        className="mt-12"
      />
    </div>
  );
}
