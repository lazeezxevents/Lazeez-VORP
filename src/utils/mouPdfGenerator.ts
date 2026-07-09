import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { MOU_TEMPLATE } from "./mouTemplate";

interface MOUGenerationData {
    owner_name: string;
    cnic: string;
    business_name: string;
    bank_details: { title: string; iban: string; bank_name: string };
    menu: Array<{ name: string; quantity: string; original_price: string; discounted_price: string }>;
    address: string;
    category: string;
    commission?: number;
    subscription?: { cost: number; threshold_orders: number };
    term_months?: number;
    templateText?: string;
}

export const generateEliteMOU = (data: MOUGenerationData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // 1. Prepare Content by replacing placeholders
    let baseTemplate = data.templateText || MOU_TEMPLATE;
    let content = baseTemplate
        .replace(/{{DATE}}/g, date)
        .replace(/{{VENDOR_NAME}}/g, data.business_name || "Nadir Catering and Pakwaan Centre")
        .replace(/{{VENDOR_CATEGORY}}/g, data.category.replace('_', ' ') || "food supplier")
        .replace(/{{VENDOR_ADDRESS}}/g, data.address || "V4HQ+WHQ Shah Faisal Town, Karachi")
        .replace(/{{COMMISSION_PERCENTAGE}}/g, (data.commission || 14).toString())
        .replace(/{{BANK_NAME}}/g, data.bank_details?.bank_name || "Bank Al Habib Limited")
        .replace(/{{BANK_ACCOUNT_NUMBER}}/g, data.bank_details?.iban || "1077-0981-0308-3001-6")
        .replace(/{{BANK_TITLE}}/g, data.bank_details?.title || "SYED SANOBER HUSSAIN")
        .replace(/{{OWNER_NAME}}/g, data.owner_name || "Syed Sanober Hussain")
        .replace(/{{CNIC}}/g, data.cnic || "42101-1234567-8")
        .replace(/{{SUBSCRIPTION_THRESHOLD}}/g, (data.subscription?.threshold_orders || 5).toString())
        .replace(/{{SUBSCRIPTION_COST}}/g, (data.subscription?.cost || 5000).toLocaleString())
        .replace(/{{TERM_MONTHS}}/g, (data.term_months || 3).toString());

    // 2. Split content into sections (manual handling of the table)
    const sections = content.split("{{PRODUCT_TABLE}}");

    // Set fonts
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Render Section 1
    let currentY = 20;
    const lines = doc.splitTextToSize(sections[0], pageWidth - 40);
    doc.text(lines, 20, currentY);
    currentY += (lines.length * 5) + 5;

    // Render Product Table
    if (data.menu && data.menu.length > 0) {
        autoTable(doc, {
            startY: currentY,
            head: [['Product Name', 'Quantity / Description', 'Original Price (PKR)', 'Discounted Price (PKR)']],
            body: data.menu.map(item => [
                item.name,
                item.quantity,
                `${item.original_price}/-`,
                `${item.discounted_price}/-`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [237, 0, 79], textColor: [255, 255, 255] },
            margin: { left: 20, right: 20 },
            didDrawPage: (data: any) => {
                currentY = data.cursor.y;
            }
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
    } else {
        doc.text("No specific products defined.", 20, currentY);
        currentY += 10;
    }

    // Render Section 2 (rest of the MOU)
    if (sections[1]) {
        const lines2 = doc.splitTextToSize(sections[1], pageWidth - 40);
        // Check for page overflow
        if (currentY + (lines2.length * 5) > 280) {
            doc.addPage();
            currentY = 20;
        }
        doc.text(lines2, 20, currentY);
    }

    const blob = doc.output('blob');
    return {
        doc,
        blob,
        filename: `MOU_${data.business_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    };
};
