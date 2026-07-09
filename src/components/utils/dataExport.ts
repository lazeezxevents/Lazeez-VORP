import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// Extend jsPDF type to include autoTable properties
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

// Vendor Export Functions
interface VendorExportData {
  id: string;
  name: string;
  category: string;
  status: string;
  owner_name?: string | null;
  owner_cnic?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
  commission_percentage?: number | null;
  subscription_amount?: number | null;
  subscription_threshold?: number | null;
  subscription_after_orders?: number | null;
  bank_title?: string | null;
  bank_account_number?: string | null;
  bank_name?: string | null;
  sticker_status?: string | null;
  rating?: number | null;
  safiac_score?: number | null;
  created_at: string;
}

export function exportVendorsToPDF(vendors: VendorExportData[]): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(237, 0, 79);
  doc.rect(0, 0, pageWidth, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("LAZEEZ EVENTS", pageWidth / 2, 12, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("VENDOR DIRECTORY REPORT", pageWidth / 2, 20, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 35);
  doc.text(`Total Vendors: ${vendors.length}`, pageWidth - 14, 35, { align: "right" });

  const tableData = vendors.map((v) => [
    v.name,
    v.category.replace("_", " ").toUpperCase(),
    v.status.toUpperCase(),
    v.owner_name || "-",
    v.phone || "-",
    v.city || "-",
    `${v.commission_percentage || 0}%`,
    v.rating ? `${v.rating}/5` : "-",
  ]);

  autoTable(doc, {
    startY: 42,
    head: [["Name", "Category", "Status", "Owner", "Phone", "City", "Commission", "Rating"]],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [237, 0, 79], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  doc.save(`Vendors_Report_${new Date().toISOString().split("T")[0]}.pdf`);
}

export function exportVendorsToExcel(vendors: VendorExportData[]): void {
  const data = [
    {
      "Vendor Name": "LAZEEZ EVENTS - VENDOR DIRECTORY REPORT",
    },
    ...vendors.map((v) => ({
      "Vendor Name": v.name,
      "Category": v.category.replace("_", " ").toUpperCase(),
      "Status": v.status.toUpperCase(),
      "Owner Name": v.owner_name || "",
      "Owner CNIC": v.owner_cnic || "",
      "Email": v.email || "",
      "Phone": v.phone || "",
      "City": v.city || "",
      "Address": v.address || "",
      "Commission %": v.commission_percentage || 0,
      "Subscription Amount": v.subscription_amount || 0,
      "Subscription Threshold": v.subscription_threshold || 0,
      "Sub After Orders": v.subscription_after_orders || 0,
      "Bank Title": v.bank_title || "",
      "Bank Account": v.bank_account_number || "",
      "Bank Name": v.bank_name || "",
      "Sticker Status": v.sticker_status || "",
      "Rating": v.rating || "",
      "SAFIAC Score": v.safiac_score || "",
      "Created At": new Date(v.created_at).toLocaleDateString(),
    }))
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vendors");

  // Set column widths
  ws["!cols"] = [
    { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 18 },
    { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
    { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
  ];

  XLSX.writeFile(wb, `Vendors_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
}

// Single Vendor Export
export function exportSingleVendorToPDF(vendor: VendorExportData, stats?: {
  totalIssues?: number;
  openIssues?: number;
  resolvedIssues?: number;
  totalPayments?: number;
  totalRevenue?: number;
}): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(237, 0, 79);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("LAZEEZ EVENTS", pageWidth / 2, 14, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("VENDOR INFORMATION REPORT", pageWidth / 2, 24, { align: "center" });

  // Vendor Name
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text(vendor.name, pageWidth / 2, 45, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 55);

  // Basic Info Table
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Basic Information", 14, 68);

  autoTable(doc, {
    startY: 72,
    head: [],
    body: [
      ["Category", vendor.category.replace("_", " ").toUpperCase()],
      ["Status", vendor.status.toUpperCase()],
      ["Owner Name", vendor.owner_name || "-"],
      ["Owner CNIC", vendor.owner_cnic || "-"],
      ["Email", vendor.email || "-"],
      ["Phone", vendor.phone || "-"],
      ["City", vendor.city || "-"],
      ["Address", vendor.address || "-"],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    theme: "grid",
  });

  let currentY = doc.lastAutoTable.finalY + 10;

  // Financial Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Financial Information", 14, currentY);

  autoTable(doc, {
    startY: currentY + 4,
    head: [],
    body: [
      ["Commission %", `${vendor.commission_percentage || 0}%`],
      ["Subscription Amount", `PKR ${(vendor.subscription_amount || 0).toLocaleString()}`],
      ["Subscription Threshold", `PKR ${(vendor.subscription_threshold || 0).toLocaleString()}`],
      ["Subscription After Orders", `${vendor.subscription_after_orders || 0}`],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    theme: "grid",
  });

  currentY = doc.lastAutoTable.finalY + 10;

  // Bank Details
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Bank Details", 14, currentY);

  autoTable(doc, {
    startY: currentY + 4,
    head: [],
    body: [
      ["Bank Name", vendor.bank_name || "-"],
      ["Account Title", vendor.bank_title || "-"],
      ["Account Number", vendor.bank_account_number || "-"],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    theme: "grid",
  });

  currentY = doc.lastAutoTable.finalY + 10;

  // Performance Metrics
  if (stats) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Performance Metrics", 14, currentY);

    autoTable(doc, {
      startY: currentY + 4,
      head: [],
      body: [
        ["Rating", vendor.rating ? `${vendor.rating}/5` : "-"],
        ["SAFIAC Score", vendor.safiac_score ? `${vendor.safiac_score}/5` : "-"],
        ["Total Issues", stats.totalIssues?.toString() || "0"],
        ["Open Issues", stats.openIssues?.toString() || "0"],
        ["Resolved Issues", stats.resolvedIssues?.toString() || "0"],
        ["Total Payments", stats.totalPayments?.toString() || "0"],
        ["Total Revenue", `PKR ${(stats.totalRevenue || 0).toLocaleString()}`],
      ],
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
      theme: "grid",
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "This document is confidential and for internal use only.",
    pageWidth / 2,
    285,
    { align: "center" }
  );

  doc.save(`Vendor_${vendor.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
}

export function exportSingleVendorToExcel(vendor: VendorExportData, stats?: {
  totalIssues?: number;
  openIssues?: number;
  resolvedIssues?: number;
  totalPayments?: number;
  totalRevenue?: number;
}): void {
  const data = [
    ["LAZEEZ EVENTS"],
    ["VENDOR INFORMATION REPORT"],
    ["Generated", new Date().toLocaleString()],
    [],
    ["BASIC INFORMATION"],
    ["Vendor Name", vendor.name],
    ["Category", vendor.category.replace("_", " ").toUpperCase()],
    ["Status", vendor.status.toUpperCase()],
    ["Owner Name", vendor.owner_name || ""],
    ["Owner CNIC", vendor.owner_cnic || ""],
    ["Email", vendor.email || ""],
    ["Phone", vendor.phone || ""],
    ["City", vendor.city || ""],
    ["Address", vendor.address || ""],
    [],
    ["FINANCIAL INFORMATION"],
    ["Commission %", `${vendor.commission_percentage || 0}%`],
    ["Subscription Amount", `PKR ${(vendor.subscription_amount || 0).toLocaleString()}`],
    ["Subscription Threshold", `PKR ${(vendor.subscription_threshold || 0).toLocaleString()}`],
    ["Subscription After Orders", vendor.subscription_after_orders || 0],
    [],
    ["BANK DETAILS"],
    ["Bank Name", vendor.bank_name || ""],
    ["Account Title", vendor.bank_title || ""],
    ["Account Number", vendor.bank_account_number || ""],
    [],
    ["PERFORMANCE METRICS"],
    ["Rating", vendor.rating ? `${vendor.rating}/5` : "-"],
    ["SAFIAC Score", vendor.safiac_score ? `${vendor.safiac_score}/5` : "-"],
    ["Sticker Status", vendor.sticker_status || ""],
  ];

  if (stats) {
    data.push(
      ["Total Issues", stats.totalIssues || 0],
      ["Open Issues", stats.openIssues || 0],
      ["Resolved Issues", stats.resolvedIssues || 0],
      ["Total Payments", stats.totalPayments || 0],
      ["Total Revenue", `PKR ${(stats.totalRevenue || 0).toLocaleString()}`]
    );
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vendor Info");

  ws["!cols"] = [{ wch: 25 }, { wch: 40 }];

  XLSX.writeFile(wb, `Vendor_${vendor.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);
}

// Payment Export Functions
interface PaymentExportData {
  id: string;
  order_id: string;
  vendor_name: string;
  order_amount: number;
  commission_amount: number;
  upfront_amount: number;
  upfront_percentage: number;
  remaining_amount: number;
  payment_status: string;
  upfront_paid_at?: string | null;
  remaining_released_at?: string | null;
  created_at: string;
  notes?: string | null;
}

export function exportPaymentsToPDF(payments: PaymentExportData[]): void {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(237, 0, 79);
  doc.rect(0, 0, pageWidth, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("LAZEEZ EVENTS", pageWidth / 2, 12, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("PAYMENT TRANSACTIONS REPORT", pageWidth / 2, 20, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 35);

  const totalAmount = payments.reduce((sum, p) => sum + p.order_amount, 0);
  const totalCommission = payments.reduce((sum, p) => sum + p.commission_amount, 0);
  doc.text(`Total Transactions: ${payments.length} | Total Amount: PKR ${totalAmount.toLocaleString()} | Total Commission: PKR ${totalCommission.toLocaleString()}`, 14, 42);

  const tableData = payments.map((p) => [
    p.order_id,
    p.vendor_name,
    `PKR ${p.order_amount.toLocaleString()}`,
    `PKR ${p.commission_amount.toLocaleString()}`,
    `PKR ${p.upfront_amount.toLocaleString()} (${p.upfront_percentage}%)`,
    `PKR ${p.remaining_amount.toLocaleString()}`,
    p.payment_status.toUpperCase(),
    p.upfront_paid_at ? new Date(p.upfront_paid_at).toLocaleDateString() : "-",
    p.remaining_released_at ? new Date(p.remaining_released_at).toLocaleDateString() : "-",
  ]);

  autoTable(doc, {
    startY: 48,
    head: [["Order ID", "Vendor", "Amount", "Commission", "Upfront", "Remaining", "Status", "Upfront Paid", "Released"]],
    body: tableData,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [237, 0, 79], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  doc.save(`Payments_Report_${new Date().toISOString().split("T")[0]}.pdf`);
}

export function exportPaymentsToExcel(payments: PaymentExportData[]): void {
  const data = [
    {
      "Order ID": "LAZEEZ EVENTS - PAYMENT TRANSACTIONS REPORT",
    },
    ...payments.map((p) => ({
      "Order ID": p.order_id,
      "Vendor": p.vendor_name,
      "Order Amount": p.order_amount,
      "Commission Amount": p.commission_amount,
      "Upfront %": p.upfront_percentage,
      "Upfront Amount": p.upfront_amount,
      "Remaining Amount": p.remaining_amount,
      "Payment Status": p.payment_status.toUpperCase(),
      "Upfront Paid At": p.upfront_paid_at ? new Date(p.upfront_paid_at).toLocaleString() : "",
      "Remaining Released At": p.remaining_released_at ? new Date(p.remaining_released_at).toLocaleString() : "",
      "Created At": new Date(p.created_at).toLocaleString(),
      "Notes": p.notes || "",
    }))
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payments");

  ws["!cols"] = [
    { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 30 },
  ];

  XLSX.writeFile(wb, `Payments_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
}

// Analytics Export Functions
interface AnalyticsExportData {
  vendorStats: {
    total: number;
    active: number;
    pending: number;
    terminated: number;
  };
  issueStats: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
  };
  mouStats: {
    total: number;
    active: number;
    expiringSoon: number;
    expired: number;
  };
  paymentStats: {
    totalRevenue: number;
    totalCommission: number;
    pendingPayments: number;
    completedPayments: number;
  };
}

export function exportAnalyticsToPDF(analytics: AnalyticsExportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(237, 0, 79);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("LAZEEZ EVENTS", pageWidth / 2, 14, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("ANALYTICS DASHBOARD REPORT", pageWidth / 2, 24, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

  // Vendor Stats
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Vendor Statistics", 14, 55);

  autoTable(doc, {
    startY: 60,
    head: [["Metric", "Value"]],
    body: [
      ["Total Vendors", analytics.vendorStats.total.toString()],
      ["Active Vendors", analytics.vendorStats.active.toString()],
      ["Pending Vendors", analytics.vendorStats.pending.toString()],
      ["Terminated Vendors", analytics.vendorStats.terminated.toString()],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [237, 0, 79], textColor: 255 },
    columnStyles: { 0: { cellWidth: 80 } },
  });

  let currentY = doc.lastAutoTable.finalY + 15;

  // Issue Stats
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Issue Statistics", 14, currentY);

  autoTable(doc, {
    startY: currentY + 5,
    head: [["Metric", "Value"]],
    body: [
      ["Total Issues", analytics.issueStats.total.toString()],
      ["Open Issues", analytics.issueStats.open.toString()],
      ["In Progress", analytics.issueStats.inProgress.toString()],
      ["Resolved Issues", analytics.issueStats.resolved.toString()],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [237, 0, 79], textColor: 255 },
    columnStyles: { 0: { cellWidth: 80 } },
  });

  currentY = doc.lastAutoTable.finalY + 15;

  // MOU Stats
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("MOU Statistics", 14, currentY);

  autoTable(doc, {
    startY: currentY + 5,
    head: [["Metric", "Value"]],
    body: [
      ["Total MOUs", analytics.mouStats.total.toString()],
      ["Active MOUs", analytics.mouStats.active.toString()],
      ["Expiring Soon", analytics.mouStats.expiringSoon.toString()],
      ["Expired MOUs", analytics.mouStats.expired.toString()],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [237, 0, 79], textColor: 255 },
    columnStyles: { 0: { cellWidth: 80 } },
  });

  currentY = doc.lastAutoTable.finalY + 15;

  // Payment Stats
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Statistics", 14, currentY);

  autoTable(doc, {
    startY: currentY + 5,
    head: [["Metric", "Value"]],
    body: [
      ["Total Revenue", `PKR ${analytics.paymentStats.totalRevenue.toLocaleString()}`],
      ["Total Commission", `PKR ${analytics.paymentStats.totalCommission.toLocaleString()}`],
      ["Pending Payments", analytics.paymentStats.pendingPayments.toString()],
      ["Completed Payments", analytics.paymentStats.completedPayments.toString()],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [237, 0, 79], textColor: 255 },
    columnStyles: { 0: { cellWidth: 80 } },
  });

  doc.save(`Analytics_Report_${new Date().toISOString().split("T")[0]}.pdf`);
}

export function exportAnalyticsToExcel(analytics: AnalyticsExportData): void {
  const data = [
    ["LAZEEZ EVENTS"],
    ["ANALYTICS DASHBOARD REPORT"],
    ["Generated", new Date().toLocaleString()],
    [],
    ["VENDOR STATISTICS"],
    ["Metric", "Value"],
    ["Total Vendors", analytics.vendorStats.total],
    ["Active Vendors", analytics.vendorStats.active],
    ["Pending Vendors", analytics.vendorStats.pending],
    ["Terminated Vendors", analytics.vendorStats.terminated],
    [],
    ["ISSUE STATISTICS"],
    ["Metric", "Value"],
    ["Total Issues", analytics.issueStats.total],
    ["Open Issues", analytics.issueStats.open],
    ["In Progress", analytics.issueStats.inProgress],
    ["Resolved Issues", analytics.issueStats.resolved],
    [],
    ["MOU STATISTICS"],
    ["Metric", "Value"],
    ["Total MOUs", analytics.mouStats.total],
    ["Active MOUs", analytics.mouStats.active],
    ["Expiring Soon", analytics.mouStats.expiringSoon],
    ["Expired MOUs", analytics.mouStats.expired],
    [],
    ["PAYMENT STATISTICS"],
    ["Metric", "Value"],
    ["Total Revenue", `PKR ${analytics.paymentStats.totalRevenue.toLocaleString()}`],
    ["Total Commission", `PKR ${analytics.paymentStats.totalCommission.toLocaleString()}`],
    ["Pending Payments", analytics.paymentStats.pendingPayments],
    ["Completed Payments", analytics.paymentStats.completedPayments],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Analytics");

  ws["!cols"] = [{ wch: 25 }, { wch: 25 }];

  XLSX.writeFile(wb, `Analytics_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
}

