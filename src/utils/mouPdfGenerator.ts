import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import lazeezLogo from "@/assets/lazeez-logo.png";
import {
    MOU_PRODUCT_TABLE_MARKER,
    MOU_SECTION_HEADINGS,
    MOU_TABLE_HEADERS,
    applyMOUPlaceholders,
    getUserBoldValues,
    resolveMOUValues,
    splitLineForBold,
    type MOUTemplateData,
} from "./mouTemplate";

interface MOUGenerationData extends MOUTemplateData {
    templateText?: string;
}

const loadImageAsBase64 = (src: string): Promise<string> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Canvas unavailable"));
                return;
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => reject(new Error("Logo load failed"));
        img.src = src;
    });

const ensurePageSpace = (doc: jsPDF, currentY: number, needed: number): number => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (currentY + needed > pageHeight - 20) {
        doc.addPage();
        return 20;
    }
    return currentY;
};

const renderParagraph = (
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    bold = false,
    align: "left" | "center" = "left"
): number => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, maxWidth);
    const pageWidth = doc.internal.pageSize.getWidth();
    for (let i = 0; i < lines.length; i++) {
        const lineY = y + i * lineHeight;
        if (align === "center") {
            doc.text(lines[i], pageWidth / 2, lineY, { align: "center" });
        } else {
            doc.text(lines[i], x, lineY);
        }
    }
    return y + lines.length * lineHeight;
};

const renderLineWithBoldValues = (
    doc: jsPDF,
    line: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    boldValues: string[],
    align: "left" | "center" = "left"
): number => {
    const segments = splitLineForBold(line, boldValues);
    const pageWidth = doc.internal.pageSize.getWidth();
    let cursorX = align === "center" ? (pageWidth - maxWidth) / 2 : x;

    if (align === "center") {
        doc.setFont("helvetica", "normal");
        const totalWidth = segments.reduce((sum, seg) => {
            doc.setFont("helvetica", seg.bold ? "bold" : "normal");
            return sum + doc.getTextWidth(seg.text);
        }, 0);
        cursorX = (pageWidth - totalWidth) / 2;
    }

    for (const seg of segments) {
        doc.setFont("helvetica", seg.bold ? "bold" : "normal");
        doc.text(seg.text, cursorX, y);
        cursorX += doc.getTextWidth(seg.text);
    }

    return y + lineHeight;
};

const renderLockedContent = (
    doc: jsPDF,
    content: string,
    startY: number,
    pageWidth: number,
    boldValues: string[]
): number => {
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    const lineHeight = 5;
    let y = startY;

    const blocks = content.split("\n");
    for (const rawLine of blocks) {
        const line = rawLine.trimEnd();
        if (!line) {
            y += 3;
            continue;
        }

        const isMainTitle = line === "Memorandum of Understanding";
        const isHeading = MOU_SECTION_HEADINGS.some(h => line === h);
        const isNumberedSection = /^\d+\.\s/.test(line);
        const isSubSection = /^[12]\.\s/.test(line) && line.includes("Responsibilities");

        y = ensurePageSpace(doc, y, lineHeight * 3);

        if (isMainTitle) {
            y += 4;
            doc.setFontSize(14);
            y = renderParagraph(doc, line, margin, y, maxWidth, lineHeight, true, "center");
            y += 2;
            doc.setFontSize(10);
            continue;
        }

        if (isHeading) {
            y += 4;
            doc.setFontSize(11);
            y = renderParagraph(doc, line, margin, y, maxWidth, lineHeight, true);
            y += 2;
            doc.setFontSize(10);
            continue;
        }

        if (isNumberedSection || isSubSection) {
            if (boldValues.some(v => line.includes(v))) {
                y = renderLineWithBoldValues(doc, line, margin, y, maxWidth, lineHeight, boldValues);
            } else {
                y = renderParagraph(doc, line, margin, y, maxWidth, lineHeight, true);
            }
            continue;
        }

        y = renderLineWithBoldValues(doc, line, margin, y, maxWidth, lineHeight, boldValues);
    }

    return y;
};

export const generateEliteMOU = async (data: MOUGenerationData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const values = resolveMOUValues(data);
    const boldValues = getUserBoldValues(data);

    // Locked logo header — always Lazeez Events branding from assets
    let currentY = 18;
    try {
        const logoBase64 = await loadImageAsBase64(lazeezLogo);
        const logoWidth = 50;
        const logoHeight = 18;
        doc.addImage(logoBase64, "PNG", (pageWidth - logoWidth) / 2, currentY, logoWidth, logoHeight);
        currentY += logoHeight + 8;
    } catch {
        // Fallback: keep heading text if logo fails to load
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(237, 0, 79);
        doc.text("Lazeez Events", pageWidth / 2, currentY + 5, { align: "center" });
        currentY += 14;
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Always use locked template — ignore uploaded/OCR templateText
    const filledTemplate = applyMOUPlaceholders(data);
    const [beforeTable, afterTable] = filledTemplate.split(MOU_PRODUCT_TABLE_MARKER);

    currentY = renderLockedContent(doc, beforeTable, currentY, pageWidth, boldValues);
    currentY += 4;

    // Product table — 3 columns only (no discounted price)
    currentY = ensurePageSpace(doc, currentY, 30);
    autoTable(doc, {
        startY: currentY,
        head: [MOU_TABLE_HEADERS.slice()],
        body: values.menu.map(item => [
            item.name,
            item.quantity,
            item.price.includes("/-") ? item.price : `${item.price}/-`,
        ]),
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", lineWidth: 0.1, lineColor: [0, 0, 0] },
        bodyStyles: { lineWidth: 0.1, lineColor: [0, 0, 0] },
        margin: { left: 20, right: 20 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;

    if (afterTable) {
        currentY = renderLockedContent(doc, afterTable.trim(), currentY, pageWidth, boldValues);
    }

    const blob = doc.output("blob");
    const businessName = data.business_name || "Vendor";
    return {
        doc,
        blob,
        filename: `MOU_${businessName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
    };
};
