import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    ImageRun,
    BorderStyle,
} from "docx";
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

interface DOCXGenerationData extends MOUTemplateData {
    templateText?: string;
}

const loadImageBuffer = async (src: string): Promise<ArrayBuffer> => {
    const response = await fetch(src);
    return response.arrayBuffer();
};

const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

const paragraphFromLine = (line: string, boldValues: string[]): Paragraph => {
    const trimmed = line.trimEnd();
    if (!trimmed) {
        return new Paragraph({ text: "", spacing: { after: 120 } });
    }

    const isMainTitle = trimmed === "Memorandum of Understanding";
    const isHeading = MOU_SECTION_HEADINGS.some(h => trimmed === h);
    const isNumberedSection = /^\d+\.\s/.test(trimmed);
    const hasUserValues = boldValues.some(v => trimmed.includes(v));

    if (isMainTitle || isHeading) {
        return new Paragraph({
            children: [
                new TextRun({
                    text: trimmed,
                    bold: true,
                    size: isMainTitle ? 28 : 22,
                }),
            ],
            spacing: { after: isHeading ? 160 : 200 },
            alignment: isMainTitle ? AlignmentType.CENTER : AlignmentType.LEFT,
        });
    }

    if (isNumberedSection && !hasUserValues) {
        return new Paragraph({
            children: [new TextRun({ text: trimmed, bold: true, size: 20 })],
            spacing: { after: 120 },
        });
    }

    const segments = splitLineForBold(trimmed, boldValues);
    return new Paragraph({
        children: segments.map(seg =>
            new TextRun({ text: seg.text, bold: seg.bold, size: 20 })
        ),
        spacing: { after: 120 },
    });
};

const contentToParagraphs = (content: string, boldValues: string[]): Paragraph[] =>
    content.split("\n").map(line => paragraphFromLine(line, boldValues));

export const generateEliteDOCX = async (data: DOCXGenerationData) => {
    const values = resolveMOUValues(data);
    const boldValues = getUserBoldValues(data);

    // Always use locked template — ignore uploaded/OCR templateText
    const filledTemplate = applyMOUPlaceholders(data);
    const [beforeTable, afterTable] = filledTemplate.split(MOU_PRODUCT_TABLE_MARKER);

    let logoParagraph: Paragraph;
    try {
        const logoBuffer = await loadImageBuffer(lazeezLogo);
        logoParagraph = new Paragraph({
            children: [
                new ImageRun({
                    data: logoBuffer,
                    transformation: { width: 180, height: 65 },
                    type: "png",
                }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
        });
    } catch {
        logoParagraph = new Paragraph({
            children: [new TextRun({ text: "Lazeez Events", bold: true, size: 32, color: "ED004F" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
        });
    }

    const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: MOU_TABLE_HEADERS.map(text =>
                    new TableCell({
                        borders: cellBorder,
                        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18 })] })],
                    })
                ),
            }),
            ...values.menu.map(item =>
                new TableRow({
                    children: [
                        item.name,
                        item.quantity,
                        item.price.includes("/-") ? item.price : `${item.price}/-`,
                    ].map(text =>
                        new TableCell({
                            borders: cellBorder,
                            children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
                        })
                    ),
                })
            ),
        ],
    });

    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    logoParagraph,
                    ...contentToParagraphs(beforeTable, boldValues),
                    table,
                    new Paragraph({ text: "", spacing: { before: 200, after: 200 } }),
                    ...contentToParagraphs(afterTable.trim(), boldValues),
                ],
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    const businessName = data.business_name || "Vendor";
    return {
        blob,
        filename: `MOU_${businessName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.docx`,
    };
};
