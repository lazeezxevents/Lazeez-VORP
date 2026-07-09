
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ImageRun } from "docx";
import { MOU_TEMPLATE } from "./mouTemplate";

interface DOCXGenerationData {
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

export const generateEliteDOCX = async (data: DOCXGenerationData) => {
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const baseTemplate = data.templateText || MOU_TEMPLATE;

    // Placeholder replacement logic
    const replacePlaceholders = (text: string) => {
        return text
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
    };

    const sections = baseTemplate.split("{{PRODUCT_TABLE}}");

    // Create document
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "MEMORANDUM OF UNDERSTANDING",
                                bold: true,
                                size: 28,
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 },
                    }),
                    ...replacePlaceholders(sections[0]).split('\n').map(line =>
                        new Paragraph({
                            children: [new TextRun(line.trim())],
                            spacing: { after: 200 },
                        })
                    ),

                    // Table
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    "Product Name", "Quantity / Description", "Original Price (PKR)", "Discounted Price (PKR)"
                                ].map(text => new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "ffffff" })] })],
                                    shading: { fill: "ed004f" }
                                }))
                            }),
                            ...(data.menu || []).map(item => new TableRow({
                                children: [
                                    item.name, item.quantity, `${item.original_price}/-`, `${item.discounted_price}/-`
                                ].map(text => new TableCell({
                                    children: [new Paragraph(text)]
                                }))
                            }))
                        ]
                    }),

                    new Paragraph({ text: "", spacing: { before: 400 } }),

                    ...replacePlaceholders(sections[1]).split('\n').map(line =>
                        new Paragraph({
                            children: [new TextRun(line.trim())],
                            spacing: { after: 200 },
                        })
                    ),
                ],
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    return {
        blob,
        filename: `MOU_${data.business_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`
    };
};
