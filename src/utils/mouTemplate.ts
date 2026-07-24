
/**
 * Locked Lazeez MOU master template — derived from 1784799317546.pdf
 * DO NOT let AI rewrite this structure. Only placeholder values change at generation time.
 * The discounted-price column is intentionally omitted from the product table.
 */

export interface MOUMenuItem {
    name: string;
    quantity: string;
    price: string;
}

export interface MOUTemplateData {
    owner_name?: string;
    cnic?: string;
    business_name?: string;
    bank_details?: { title?: string; iban?: string; bank_name?: string };
    menu?: MOUMenuItem[];
    address?: string;
    category?: string;
    commission?: number;
    subscription?: { cost?: number; threshold_orders?: number };
    term_months?: number;
}

/** Table columns — discounted price column is NOT included */
export const MOU_TABLE_HEADERS = [
    "Product Name",
    "Quantity / Description (min)",
    "Original Price (PKR)",
] as const;

/** Default product rows from the master MOU (without discounted prices) */
export const DEFAULT_MOU_MENU: MOUMenuItem[] = [
    { name: "Gosht Pulao", quantity: "5 Kg", price: "2600/- per Kg" },
    { name: "Chicken Pulao", quantity: "5 Kg", price: "2100/- per Kg" },
    { name: "Chicken Biryani", quantity: "5 Kg", price: "2100/- per Kg" },
    { name: "Mutton Biryani", quantity: "5 Kg", price: "3500/- per Kg" },
    { name: "Mutton Pulao", quantity: "5 Kg", price: "3500/- per Kg" },
    { name: "Akni Gosht", quantity: "5 Kg", price: "2600/- per Kg" },
    { name: "Chicken Qorma", quantity: "5 Kg", price: "1700/- per Kg" },
    { name: "Beef Qorma", quantity: "5 Kg", price: "2100/- per Kg" },
    { name: "Beef Qeema", quantity: "5 Kg", price: "2300/- per Kg" },
    { name: "Mutton Qorma", quantity: "5 Kg", price: "2900/- per Kg" },
    { name: "Sa'weiya", quantity: "1Kg", price: "3100/- per Kg" },
    { name: "Haleem (Per Head)", quantity: "100 Heads (With Est. Quantity 65 Kg)", price: "350/- per Head" },
    { name: "Bori Chicken", quantity: "5 Kg", price: "1800/- per Kg" },
    { name: "Zarda", quantity: "5 Kg", price: "1300/- per Kg" },
    { name: "Kheer", quantity: "5 Kg", price: "1300/- per Kg" },
    { name: "White Rose Qorma", quantity: "5 Kg", price: "1700/- per Kg" },
    { name: "Lab-e-Sheereen", quantity: "5 Kg", price: "1300/- per Kg" },
];

export const formatMOUDate = (d: Date = new Date()): string => {
    const day = d.getDate();
    const suffix =
        day % 10 === 1 && day !== 11 ? "st" :
        day % 10 === 2 && day !== 12 ? "nd" :
        day % 10 === 3 && day !== 13 ? "rd" : "th";
    const month = d.toLocaleDateString("en-GB", { month: "long" });
    const year = d.getFullYear();
    return `${day}${suffix} of ${month}, ${year}`;
};

export const formatMOUSignatureDate = (d: Date = new Date()): string => {
    const day = d.getDate();
    const suffix =
        day % 10 === 1 && day !== 11 ? "st" :
        day % 10 === 2 && day !== 12 ? "nd" :
        day % 10 === 3 && day !== 13 ? "rd" : "th";
    const month = d.toLocaleDateString("en-GB", { month: "short" });
    const year = d.getFullYear();
    return `${day}${suffix} ${month}, ${year}`;
};

export const resolveMOUValues = (data: MOUTemplateData) => {
    const date = formatMOUDate();
    const signatureDate = formatMOUSignatureDate();
    const category = (data.category || "food supplier").replace(/_/g, " ");

    return {
        date,
        signatureDate,
        vendorName: data.business_name || "Vendor Name",
        vendorCategory: category,
        vendorAddress: data.address || "Vendor Address",
        commission: (data.commission ?? 10).toString(),
        bankName: data.bank_details?.bank_name || "HMB (Cloth Market BR)",
        bankAccount: data.bank_details?.iban || "PK05MPBL0111017140281322",
        bankTitle: data.bank_details?.title || "Account Title",
        ownerName: data.owner_name || "Vendor Representative",
        cnic: data.cnic || "XXXXX-XXXXXXX-X",
        subscriptionThreshold: (data.subscription?.threshold_orders ?? 5).toString(),
        subscriptionCost: (data.subscription?.cost ?? 5000).toLocaleString(),
        termMonths: (data.term_months ?? 6).toString(),
        menu: data.menu?.length ? data.menu : DEFAULT_MOU_MENU,
    };
};

/** Marker kept for backward compatibility — table is rendered separately */
export const MOU_PRODUCT_TABLE_MARKER = "{{PRODUCT_TABLE}}";

/**
 * Locked body text (before and after the product table).
 * Placeholders are replaced at generation; structure must never be AI-edited.
 */
export const MOU_TEMPLATE = `Memorandum of Understanding

This Revised Memorandum of Understanding (MoU) is entered into on this {{DATE}} by and between:

1. Lazeez Events – A food and events-based SaaS platform, having its principal office at Progressive Plaza, hereinafter referred to as the "First Party" or "Lazeez Events";

AND

2. {{VENDOR_NAME}}, a {{VENDOR_CATEGORY}}, having its principal Office at {{VENDOR_ADDRESS}}, hereinafter referred to as the "Second Party" or "Vendor".

Collectively referred to as the "Parties."

Purpose of the MoU

The purpose of this Memorandum of Understanding (MoU) is to establish a collaborative partnership between Lazeez Events and the mentioned Vendor. This collaboration aims to provide the Vendor with an opportunity to showcase and sell their products through Lazeez Events established online platform. This allows Vendors to offer their goods in a digital format without the need to develop and maintain their own e-commerce infrastructure.

This MoU serves as a mutual understanding of the terms and framework under which Lazeez Events will support the Vendor in making their products accessible online, as part of Lazeez Events' broader efforts to connect quality vendors with a wider customer base.

Scope of Collaboration

1. Vendor Responsibilities:
• Provide high-quality food that meet the specifications outlined by Lazeez Events.
• Ensure the timely supply of goods as per the agreed schedule.
• Maintain reasonable and agreed pricing for the goods.
• Ensure compliance with all legal, regulatory, and safety standards related to the goods supplied.
• Any fault or issue in delivery or product quality will be solely borne by the Vendor. Lazeez Events will not be responsible for any losses or liabilities incurred due to Vendor mismanagement. In such cases, Lazeez Events will not release any commission for that specific order.

2. Lazeez Events Responsibilities:
• Provide the Vendor with clear specifications of required goods, including delivery timelines.
• Facilitate customer access to Vendor products through the platform.
• Transfer payments to the Vendor after deducting the agreed commission as outlined in the "Terms of Payment" section.

3. Mutual Responsibilities:
• Both Parties agree to cooperate in good faith to achieve the shared goal of delivering quality packages to the intended customers.
• Both Parties will communicate promptly to resolve any operational, logistical, or quality-related concerns.

4. Product List & Pricing
${MOU_PRODUCT_TABLE_MARKER}

Lazeez Events Commission: {{COMMISSION_PERCENTAGE}}%

5. Terms of Payment
• The customer will make advance payment to Lazeez Events.
• Lazeez Events will deduct its commission from the advance and transfer the remaining amount to the Vendor's provided bank account named {{BANK_NAME}}
• with IBAN {{BANK_ACCOUNT_NUMBER}} with Title: {{BANK_TITLE}} within 3-4 working days.
• Any remaining balance due at the time of delivery can be directly received by the Vendor.
• All payments shall be made via Bank transfer (HMB cloth market) within 30 days of invoice submission.

6. Stickers and Branding:
• The logo of Lazeez Events will be inserted in the branded stickers of the Vendor. All associated costs for the creation will be borne exclusively by the Vendor.
• The packaging design will be provided by Lazeez Events, which will include branding for both Lazeez Events and the Vendor (e.g., logos, labels).
• The Vendor agrees to use this co-branded packaging or stickers for all orders that originate from Lazeez Events.

Quality Control & Customer Feedback Clause
• If customer reviews and ratings consistently fall below 3 out of 5, the Vendor may be removed from the Lazeez Events platform without prior notice.
• Lazeez Events reserves the right to prioritize customer satisfaction and quality assurance as part of its platform policy.

Confidentiality
Both Parties agree to maintain the confidentiality of any proprietary or sensitive information shared during this partnership and not disclose it to any third party without prior written consent.

Subscription Terms (to be filled by Vendor)
• Vendor Name: {{OWNER_NAME}}
• After how many orders will the subscription be granted? ________{{SUBSCRIPTION_THRESHOLD}}____________.
• Subscription Cost for Lazeez Events: ________{{SUBSCRIPTION_COST}}_______________ PKR.

Term, Termination, and Auto-Renewal
1. Term: This MoU will remain in effect for a period of __________{{TERM_MONTHS}}_____________ Months from the date of signing, unless terminated earlier by either Party.
2. Termination: Either Party may terminate this MoU by providing thirty (30) days written notice to the other Party.
3. Auto-Termination on Poor Performance: In case of repeated negative customer reviews or failure to meet order standards, Lazeez Events reserves the right to terminate this agreement without notice.
4. Auto-Renewal and Price Revision: Upon expiry of the initial term, this MoU shall automatically renew for a further period of three (3) months on the same terms and conditions, provided that no price revisions are applicable. In the event that price revisions are made in accordance with the agreed conditions, a revised version of this MoU, reflecting such revisions, shall be duly executed and signed by both Parties, and the MoU shall then renew for the said three (3) months on the revised terms and conditions.

Dispute Resolution
Any disputes arising out of or in connection with this MoU will be resolved amicably through mutual consultation. If no resolution is reached, the dispute will be referred to arbitration in accordance with the applicable laws of Pakistan.

Miscellaneous
• This MoU does not create any binding legal obligation but serves as a statement of intent between the Parties.
• Any amendments to this MoU must be made in writing and signed by both Parties.

Signatures

For Lazeez Events:
Signature: ______________________
Name: Syed Raza Abbas Abidi
Designation: Co-lead and Sales Executive
Date: _____{{SIGNATURE_DATE}}__________

Signature: ______________________
Name: Ali Ayaz Sewani
Designation: Graphics & Branch Operation Lead
Date: _____{{SIGNATURE_DATE}}__________

For Vendor:
Signature: _________________ ______
Name: {{OWNER_NAME}} CNIC No. of the Representative: {{CNIC}}
Designation: ______Owner_________
Date: _________{{SIGNATURE_DATE}}_______`;

export const applyMOUPlaceholders = (data: MOUTemplateData): string => {
    const v = resolveMOUValues(data);
    return MOU_TEMPLATE
        .replace(/{{DATE}}/g, v.date)
        .replace(/{{VENDOR_NAME}}/g, v.vendorName)
        .replace(/{{VENDOR_CATEGORY}}/g, v.vendorCategory)
        .replace(/{{VENDOR_ADDRESS}}/g, v.vendorAddress)
        .replace(/{{COMMISSION_PERCENTAGE}}/g, v.commission)
        .replace(/{{BANK_NAME}}/g, v.bankName)
        .replace(/{{BANK_ACCOUNT_NUMBER}}/g, v.bankAccount)
        .replace(/{{BANK_TITLE}}/g, v.bankTitle)
        .replace(/{{OWNER_NAME}}/g, v.ownerName)
        .replace(/{{CNIC}}/g, v.cnic)
        .replace(/{{SUBSCRIPTION_THRESHOLD}}/g, v.subscriptionThreshold)
        .replace(/{{SUBSCRIPTION_COST}}/g, v.subscriptionCost)
        .replace(/{{TERM_MONTHS}}/g, v.termMonths)
        .replace(/{{SIGNATURE_DATE}}/g, v.signatureDate);
};

/** Section headings that should render bold in PDF/DOCX */
export const MOU_SECTION_HEADINGS = [
    "Memorandum of Understanding",
    "Purpose of the MoU",
    "Scope of Collaboration",
    "Quality Control & Customer Feedback Clause",
    "Confidentiality",
    "Subscription Terms (to be filled by Vendor)",
    "Term, Termination, and Auto-Renewal",
    "Dispute Resolution",
    "Miscellaneous",
    "Signatures",
];
