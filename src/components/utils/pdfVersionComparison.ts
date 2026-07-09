import jsPDF from "jspdf";
import { format } from "date-fns";

interface MOUVersion {
  id: string;
  version_number: number;
  title: string;
  status: string;
  terms: string | null;
  start_date: string | null;
  end_date: string | null;
  document_url: string | null;
  created_at: string;
}

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: unknown) => jsPDF;
  }
}

export function generateVersionComparisonPDF(
  mouTitle: string,
  leftVersion: MOUVersion,
  rightVersion: MOUVersion
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(237, 0, 79);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("MOU VERSION COMPARISON REPORT", pageWidth / 2, 20, { align: "center" });
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(mouTitle, pageWidth / 2, 32, { align: "center" });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Document Info
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, 20, 55);
  doc.text(
    `Comparing Version ${leftVersion.version_number} → Version ${rightVersion.version_number}`,
    pageWidth - 20,
    55,
    { align: "right" }
  );
  
  // Horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 60, pageWidth - 20, 60);
  
  let currentY = 75;
  
  // Helper function to add comparison section
  const addComparisonSection = (
    label: string,
    leftValue: string,
    rightValue: string,
    changed: boolean
  ) => {
    if (currentY > 250) {
      doc.addPage();
      currentY = 30;
    }
    
    // Section header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(label, 20, currentY);
    
    if (changed) {
      doc.setFontSize(8);
      doc.setTextColor(237, 137, 54); // Warning orange
      doc.text("CHANGED", pageWidth - 20, currentY, { align: "right" });
    }
    
    currentY += 8;
    
    // Draw comparison boxes
    const boxWidth = (pageWidth - 50) / 2;
    const boxHeight = 25;
    
    // Left box (older version)
    if (changed) {
      doc.setFillColor(254, 243, 242); // Light red
    } else {
      doc.setFillColor(245, 245, 245);
    }
    doc.roundedRect(20, currentY, boxWidth, boxHeight, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Version ${leftVersion.version_number}`, 25, currentY + 6);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const leftText = doc.splitTextToSize(leftValue || "Not set", boxWidth - 10);
    doc.text(leftText.slice(0, 2), 25, currentY + 14);
    
    // Arrow
    doc.setTextColor(150, 150, 150);
    doc.text("→", pageWidth / 2, currentY + 14, { align: "center" });
    
    // Right box (newer version)
    if (changed) {
      doc.setFillColor(236, 253, 245); // Light green
    } else {
      doc.setFillColor(245, 245, 245);
    }
    doc.roundedRect(pageWidth / 2 + 5, currentY, boxWidth, boxHeight, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Version ${rightVersion.version_number}`, pageWidth / 2 + 10, currentY + 6);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const rightText = doc.splitTextToSize(rightValue || "Not set", boxWidth - 10);
    doc.text(rightText.slice(0, 2), pageWidth / 2 + 10, currentY + 14);
    
    currentY += boxHeight + 12;
  };
  
  // Add comparison sections
  addComparisonSection(
    "Status",
    leftVersion.status.replace("_", " ").toUpperCase(),
    rightVersion.status.replace("_", " ").toUpperCase(),
    leftVersion.status !== rightVersion.status
  );
  
  addComparisonSection(
    "Title",
    leftVersion.title,
    rightVersion.title,
    leftVersion.title !== rightVersion.title
  );
  
  const leftDateRange = `${leftVersion.start_date ? format(new Date(leftVersion.start_date), "MMM d, yyyy") : "Not set"} - ${leftVersion.end_date ? format(new Date(leftVersion.end_date), "MMM d, yyyy") : "Not set"}`;
  const rightDateRange = `${rightVersion.start_date ? format(new Date(rightVersion.start_date), "MMM d, yyyy") : "Not set"} - ${rightVersion.end_date ? format(new Date(rightVersion.end_date), "MMM d, yyyy") : "Not set"}`;
  
  addComparisonSection(
    "Duration",
    leftDateRange,
    rightDateRange,
    leftVersion.start_date !== rightVersion.start_date || leftVersion.end_date !== rightVersion.end_date
  );
  
  addComparisonSection(
    "Document Attached",
    leftVersion.document_url ? "Yes" : "No",
    rightVersion.document_url ? "Yes" : "No",
    leftVersion.document_url !== rightVersion.document_url
  );
  
  // Terms comparison (larger section)
  if (currentY > 180) {
    doc.addPage();
    currentY = 30;
  }
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Terms & Conditions", 20, currentY);
  
  const termsChanged = leftVersion.terms !== rightVersion.terms;
  if (termsChanged) {
    doc.setFontSize(8);
    doc.setTextColor(237, 137, 54);
    doc.text("CHANGED", pageWidth - 20, currentY, { align: "right" });
  }
  
  currentY += 8;
  
  // Left terms box
  const termsBoxHeight = 50;
  if (termsChanged) {
    doc.setFillColor(254, 243, 242);
  } else {
    doc.setFillColor(245, 245, 245);
  }
  doc.roundedRect(20, currentY, pageWidth - 40, termsBoxHeight, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Version ${leftVersion.version_number}`, 25, currentY + 6);
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  const leftTerms = doc.splitTextToSize(leftVersion.terms || "No terms specified", pageWidth - 50);
  doc.text(leftTerms.slice(0, 5), 25, currentY + 14);
  
  currentY += termsBoxHeight + 5;
  
  // Right terms box
  if (termsChanged) {
    doc.setFillColor(236, 253, 245);
  } else {
    doc.setFillColor(245, 245, 245);
  }
  doc.roundedRect(20, currentY, pageWidth - 40, termsBoxHeight, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Version ${rightVersion.version_number}`, 25, currentY + 6);
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  const rightTerms = doc.splitTextToSize(rightVersion.terms || "No terms specified", pageWidth - 50);
  doc.text(rightTerms.slice(0, 5), 25, currentY + 14);
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Lazeez Events - MOU Version Comparison Report - Confidential",
    pageWidth / 2,
    285,
    { align: "center" }
  );
  
  // Save
  const fileName = `MOU_Comparison_${mouTitle.replace(/\s+/g, "_")}_v${leftVersion.version_number}_to_v${rightVersion.version_number}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
