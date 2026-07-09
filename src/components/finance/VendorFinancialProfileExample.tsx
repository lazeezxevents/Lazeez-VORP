/**
 * Example Integration Component
 * 
 * This component demonstrates how to integrate the VendorFinancialProfileCard
 * into the vendor detail page or vendor management interface.
 * 
 * Usage in VendorDetail.tsx:
 * 
 * import { VendorFinancialProfileCard } from "@/components/finance/VendorFinancialProfileCard";
 * 
 * // Inside your vendor detail component:
 * <VendorFinancialProfileCard vendorId={vendorId} />
 * 
 * The component will:
 * 1. Automatically fetch the vendor's financial profile
 * 2. Display financial summary (revenue, commissions, payouts)
 * 3. Show commission configuration
 * 4. Allow editing commission rules via dialog
 * 5. Handle initialization if profile doesn't exist
 */

import { VendorFinancialProfileCard } from "./VendorFinancialProfileCard";

interface VendorFinancialProfileExampleProps {
  vendorId: string;
}

export function VendorFinancialProfileExample({ vendorId }: VendorFinancialProfileExampleProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Financial profile</h2>
        <p className="text-muted-foreground">
          Manage commission rules, track financial performance, and view payout history
        </p>
      </div>

      <VendorFinancialProfileCard vendorId={vendorId} />
    </div>
  );
}

/**
 * Alternative: Inline Integration Example
 * 
 * If you want to add the financial profile to an existing vendor detail page
 * with tabs or sections, you can use it like this:
 * 
 * <Tabs defaultValue="overview">
 *   <TabsList>
 *     <TabsTrigger value="overview">Overview</TabsTrigger>
 *     <TabsTrigger value="financial">Financial</TabsTrigger>
 *   </TabsList>
 *   
 *   <TabsContent value="overview">
 *     {/* Existing vendor overview content *\/}
 *   </TabsContent>
 *   
 *   <TabsContent value="financial">
 *     <VendorFinancialProfileCard vendorId={vendorId} />
 *   </TabsContent>
 * </Tabs>
 */
