import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { 
  BookOpen, 
  Plus, 
  FileText, 
  Settings,
  Receipt,
  DollarSign,
  CreditCard,
  Wallet,
  FileSpreadsheet,
  Table,
  Bot,
  Activity,
  LayoutDashboard,
  FileCheck,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JournalEntryForm } from "./JournalEntryForm";
import { JournalEntryList } from "./JournalEntryList";
import { ChartOfAccounts } from "./ChartOfAccounts";
import { CurrencySelector } from "./CurrencySelector";
import { InvoiceList } from "./InvoiceList";
import { ExpenseManagementPage } from "./ExpenseManagementPage";
import { ReceiptVaultDashboard } from "./ReceiptVaultDashboard";
import { AccountsReceivableDashboard } from "./AccountsReceivableDashboard";
import { VendorPayoutDashboard } from "./VendorPayoutDashboard";
import { WorkbookInterface } from "./WorkbookInterface";
import { FinanceDashboard } from "./FinanceDashboard";
import { AIFinanceAssistant } from "./AIFinanceAssistant";
import { CashFlowPrediction } from "./CashFlowPrediction";
import { TaxReportingPage } from "./TaxReportingPage";
import { VendorFinancialProfileList } from "./VendorFinancialProfileList";
import { useAuth } from "@/contexts/AuthContext";

/**
 * General Ledger Page Component
 * 
 * Comprehensive finance module with all features:
 * - General Ledger (journal entries, chart of accounts)
 * - Invoicing & Billing
 * - Expense Management
 * - Receipt Vault
 * - Accounts Receivable
 * - Vendor Payouts
 * - Financial Reports (P&L, Cash Flow)
 * - Budgeting
 */

interface GeneralLedgerPageProps {
  onTabChange?: (tab: string) => void;
}

export function GeneralLedgerPage({ onTabChange }: GeneralLedgerPageProps) {
  const [activeTab, setActiveTab] = useState("entries");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState("PKR");
  const { isAdmin } = useAuth();
  const tabsRef = useRef<HTMLDivElement>(null);
  
  // Drag-to-scroll state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Drag event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tabsRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tabsRef.current.offsetLeft);
    setScrollLeft(tabsRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !tabsRef.current) return;
    e.preventDefault();
    const x = e.pageX - tabsRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    tabsRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-6">
      {/* Action Button */}
      {activeTab === "entries" && !showCreateForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end"
        >
          <Button onClick={() => setShowCreateForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New journal entry
          </Button>
        </motion.div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="relative bg-muted/30 p-1.5 rounded-2xl mb-8">
          {/* Drag Indicator */}
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-10 bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-muted-foreground/40"></div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/40"></div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/40"></div>
            </div>
            <span>Drag to scroll</span>
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-muted-foreground/40"></div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/40"></div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/40"></div>
            </div>
          </div>
          
          <div 
            ref={tabsRef}
            className="overflow-x-auto overflow-y-hidden group"
            style={{ 
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              scrollbarColor: 'hsl(var(--primary) / 0.3) transparent',
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            <style jsx>{`
              div::-webkit-scrollbar {
                height: 6px;
              }
              div::-webkit-scrollbar-track {
                background: transparent;
              }
              div::-webkit-scrollbar-thumb {
                background: hsl(var(--primary) / 0.3);
                border-radius: 10px;
              }
              div::-webkit-scrollbar-thumb:hover {
                background: hsl(var(--primary) / 0.5);
              }
            `}</style>
            <TabsList className="bg-transparent h-auto gap-1 inline-flex w-max">
              <TabsTrigger 
                value="dashboard" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger 
                value="entries" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <FileText className="w-4 h-4" />
                Journal entries
              </TabsTrigger>
              <TabsTrigger 
                value="accounts" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <BookOpen className="w-4 h-4" />
                Accounts
              </TabsTrigger>
              <TabsTrigger 
                value="invoices" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Invoices
              </TabsTrigger>
              <TabsTrigger 
                value="expenses" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <CreditCard className="w-4 h-4" />
                Expenses
              </TabsTrigger>
              <TabsTrigger 
                value="receipts" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <Receipt className="w-4 h-4" />
                Receipts
              </TabsTrigger>
              <TabsTrigger 
                value="receivables" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <DollarSign className="w-4 h-4" />
                Receivables
              </TabsTrigger>
              <TabsTrigger 
                value="payouts" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <Wallet className="w-4 h-4" />
                Payouts
              </TabsTrigger>
              <TabsTrigger 
                value="vendors" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <Building2 className="w-4 h-4" />
                Vendors
              </TabsTrigger>
              <TabsTrigger 
                value="spreadsheet" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <Table className="w-4 h-4" />
                Spreadsheet
              </TabsTrigger>
              <TabsTrigger 
                value="cashflow" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <Activity className="w-4 h-4" />
                Cash flow
              </TabsTrigger>
              <TabsTrigger 
                value="tax" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <FileCheck className="w-4 h-4" />
                Tax
              </TabsTrigger>
              <TabsTrigger 
                value="ai" 
                className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
              >
                <Bot className="w-4 h-4" />
                AI assistant
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger 
                  value="settings" 
                  className="rounded-xl px-4 py-2.5 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-medium text-xs tracking-tight whitespace-nowrap flex-shrink-0"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </div>

        <TabsContent value="dashboard" className="mt-6">
          <FinanceDashboard />
        </TabsContent>

        <TabsContent value="entries" className="space-y-6 mt-6">
          {showCreateForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <JournalEntryForm
                onSuccess={() => {
                  setShowCreateForm(false);
                }}
              />
              <div className="flex justify-end mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}

          <JournalEntryList />
        </TabsContent>

        <TabsContent value="accounts" className="mt-6">
          <ChartOfAccounts />
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <InvoiceList />
        </TabsContent>

        <TabsContent value="expenses" className="mt-6">
          <ExpenseManagementPage />
        </TabsContent>

        <TabsContent value="receipts" className="mt-6">
          <ReceiptVaultDashboard />
        </TabsContent>

        <TabsContent value="receivables" className="mt-6">
          <AccountsReceivableDashboard />
        </TabsContent>

        <TabsContent value="payouts" className="mt-6">
          <VendorPayoutDashboard />
        </TabsContent>

        <TabsContent value="vendors" className="mt-6">
          <VendorFinancialProfileList />
        </TabsContent>

        <TabsContent value="spreadsheet" className="mt-6">
          <WorkbookInterface workbookId="default" />
        </TabsContent>

        <TabsContent value="cashflow" className="mt-6">
          <CashFlowPrediction />
        </TabsContent>

        <TabsContent value="tax" className="mt-6">
          <TaxReportingPage />
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <AIFinanceAssistant />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="settings" className="mt-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Base currency</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select the primary currency for your financial operations
                </p>
                <CurrencySelector
                  value={selectedCurrency}
                  onChange={setSelectedCurrency}
                  showRate={false}
                />
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
