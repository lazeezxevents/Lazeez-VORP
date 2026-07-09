import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface MOUData {
  title: string;
  vendor: { name: string } | null;
  terms: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
}

export function generateMOUPDF(mou: MOUData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(237, 0, 79); // Primary color
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("MEMORANDUM OF UNDERSTANDING", pageWidth / 2, 25, { align: "center" });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // MOU Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(mou.title, pageWidth / 2, 55, { align: "center" });
  
  // Document Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Document Date: ${new Date().toLocaleDateString()}`, 20, 70);
  doc.text(`Status: ${mou.status.toUpperCase()}`, pageWidth - 20, 70, { align: "right" });
  
  // Horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 75, pageWidth - 20, 75);
  
  // Parties Section
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("PARTIES", 20, 90);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("This Memorandum of Understanding is entered into between:", 20, 100);
  doc.text("• Lazeez Events (hereinafter referred to as 'Company')", 25, 110);
  doc.text(`• ${mou.vendor?.name || "Vendor"} (hereinafter referred to as 'Vendor')`, 25, 118);
  
  // Duration Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DURATION", 20, 135);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const startDate = mou.start_date ? new Date(mou.start_date).toLocaleDateString() : "TBD";
  const endDate = mou.end_date ? new Date(mou.end_date).toLocaleDateString() : "TBD";
  doc.text(`Effective Date: ${startDate}`, 20, 145);
  doc.text(`Expiration Date: ${endDate}`, 20, 153);
  
  // Terms Section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TERMS AND CONDITIONS", 20, 170);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  if (mou.terms) {
    const terms = doc.splitTextToSize(mou.terms, pageWidth - 40);
    doc.text(terms, 20, 180);
  } else {
    doc.text("No specific terms defined.", 20, 180);
  }
  
  // Signature Section
  const signatureY = 220;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("SIGNATURES", 20, signatureY);
  
  // Company signature
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("For Lazeez Events:", 20, signatureY + 15);
  doc.line(20, signatureY + 35, 90, signatureY + 35);
  doc.text("Authorized Signature", 20, signatureY + 42);
  doc.text("Date: _______________", 20, signatureY + 52);
  
  // Vendor signature
  doc.text(`For ${mou.vendor?.name || "Vendor"}:`, pageWidth / 2 + 10, signatureY + 15);
  doc.line(pageWidth / 2 + 10, signatureY + 35, pageWidth - 20, signatureY + 35);
  doc.text("Authorized Signature", pageWidth / 2 + 10, signatureY + 42);
  doc.text("Date: _______________", pageWidth / 2 + 10, signatureY + 52);
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "This document is confidential and intended solely for the parties mentioned above.",
    pageWidth / 2,
    285,
    { align: "center" }
  );
  
  // Save
  doc.save(`MOU_${mou.title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
}

