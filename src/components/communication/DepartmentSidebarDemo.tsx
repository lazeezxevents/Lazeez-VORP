import { useState } from "react";
import { DepartmentSidebar } from "./DepartmentSidebar";
import { CommunicationLayout } from "./CommunicationLayout";

/**
 * DepartmentSidebarDemo — uses the live DepartmentSidebar (Supabase-backed).
 * Legacy mock-based demo props were removed when the sidebar was wired to real data.
 */
export const DepartmentSidebarDemo = () => {
  const [selection, setSelection] = useState<{ id: string; name: string } | null>(null);

  return (
    <CommunicationLayout
      sidebar={
        <DepartmentSidebar
          onChannelSelect={(channelId, channelName) => {
            setSelection({ id: channelId, name: channelName });
          }}
        />
      }
    >
      <div className="flex items-center justify-center h-full bg-background p-8">
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-xl font-semibold">Sidebar demo</h2>
          <p className="text-sm text-muted-foreground">
            Data loads from your Supabase project (departments, channels, membership).
          </p>
          {selection ? (
            <p className="text-sm">
              Selected: <span className="font-medium">#{selection.name}</span> ({selection.id})
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Select a channel from the sidebar.</p>
          )}
        </div>
      </div>
    </CommunicationLayout>
  );
};
