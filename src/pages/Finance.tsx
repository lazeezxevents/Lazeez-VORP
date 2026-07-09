import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GeneralLedgerPage } from "@/components/finance";

export default function Finance() {
  const [activeTab, setActiveTab] = useState("entries");

  const getTitleAndSubtitle = () => {
    switch (activeTab) {
      case "dashboard":
        return {
          title: "Finance Dashboard",
          subtitle: "Overview of financial metrics and KPIs",
        };
      case "entries":
        return {
          title: "Journal Entries",
          subtitle: "Record and manage financial transactions",
        };
      case "accounts":
        return {
          title: "Chart of Accounts",
          subtitle: "Manage your account structure and categories",
        };
      case "invoices":
        return {
          title: "Invoices",
          subtitle: "Manage customer invoices and billing",
        };
      case "expenses":
        return {
          title: "Expense Management",
          subtitle: "Submit and approve employee expenses",
        };
      case "receipts":
        return {
          title: "Receipt Vault",
          subtitle: "Store and manage receipts with AI extraction",
        };
      case "receivables":
        return {
          title: "Accounts Receivable",
          subtitle: "Track customer payments and aging",
        };
      case "payouts":
        return {
          title: "Vendor Payouts",
          subtitle: "Manage vendor payments and commissions",
        };
      case "vendors":
        return {
          title: "Vendor Financial Profiles",
          subtitle: "Manage vendor commission rules and financial data",
        };
      case "spreadsheet":
        return {
          title: "Financial Modeling",
          subtitle: "Excel-like spreadsheet for financial analysis",
        };
      case "cashflow":
        return {
          title: "Cash Flow Prediction",
          subtitle: "AI-powered cash flow forecasting and analysis",
        };
      case "tax":
        return {
          title: "Tax Reporting",
          subtitle: "Manage tax compliance and reporting",
        };
      case "ai":
        return {
          title: "AI Finance Assistant",
          subtitle: "Get intelligent financial insights and recommendations",
        };
      case "settings":
        return {
          title: "Finance Settings",
          subtitle: "Configure currency and financial preferences",
        };
      default:
        return {
          title: "Finance",
          subtitle: "Comprehensive financial management",
        };
    }
  };

  const { title, subtitle } = getTitleAndSubtitle();

  return (
    <DashboardLayout title={title} subtitle={subtitle}>
      <GeneralLedgerPage onTabChange={setActiveTab} />
    </DashboardLayout>
  );
}
