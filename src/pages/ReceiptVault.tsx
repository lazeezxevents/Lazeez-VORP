/**
 * Receipt Vault Page
 * Main page for Receipt Vault feature
 * Integrates dashboard and detail view
 */

import { useState } from "react";
import { ReceiptVaultDashboard } from "@/components/finance/ReceiptVaultDashboard";
import { ReceiptDetailView } from "@/components/finance/ReceiptDetailView";

export default function ReceiptVault() {
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  return (
    <>
      <ReceiptVaultDashboard />
      
      {selectedReceiptId && (
        <ReceiptDetailView
          receiptId={selectedReceiptId}
          open={!!selectedReceiptId}
          onClose={() => setSelectedReceiptId(null)}
        />
      )}
    </>
  );
}
