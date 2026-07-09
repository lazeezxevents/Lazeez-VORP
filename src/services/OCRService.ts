import Tesseract, { createWorker, Worker } from "tesseract.js";

export interface OCRResult {
  text: string;
  confidence: number;
  blocks?: Tesseract.Block[];
}

export class OCRService {
  private static worker: Worker | null = null;
  private static isInitialized = false;

  /**
   * Initialize Tesseract worker
   */
  private static async initializeWorker(): Promise<Worker> {
    if (this.worker && this.isInitialized) {
      return this.worker;
    }

    const worker = await createWorker("eng", 1, {
      logger: (m) => {
        // Log progress for debugging
        if (m.status === "recognizing text") {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    this.worker = worker;
    this.isInitialized = true;

    return worker;
  }

  /**
   * Extract text from image using OCR
   */
  static async extractText(imageSource: string | File | Blob): Promise<OCRResult> {
    try {
      const worker = await this.initializeWorker();

      // Perform OCR
      const result = await worker.recognize(imageSource);

      // Calculate average confidence from all words
      const words = result.data.words || [];
      const avgConfidence = words.length > 0
        ? words.reduce((sum, word) => sum + word.confidence, 0) / words.length
        : 0;

      return {
        text: result.data.text,
        confidence: avgConfidence,
        blocks: result.data.blocks,
      };
    } catch (error) {
      console.error("OCR extraction failed:", error);
      throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Extract text from PDF (first page only)
   */
  static async extractTextFromPDF(pdfFile: File): Promise<OCRResult> {
    try {
      // For PDF files, we need to convert to image first
      // This is a simplified version - in production, you'd use pdf.js to render pages
      const worker = await this.initializeWorker();
      
      const result = await worker.recognize(pdfFile);

      const words = result.data.words || [];
      const avgConfidence = words.length > 0
        ? words.reduce((sum, word) => sum + word.confidence, 0) / words.length
        : 0;

      return {
        text: result.data.text,
        confidence: avgConfidence,
        blocks: result.data.blocks,
      };
    } catch (error) {
      console.error("PDF OCR extraction failed:", error);
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Extract text from image file with format detection
   */
  static async extractFromFile(file: File): Promise<OCRResult> {
    const fileType = file.type.toLowerCase();

    if (fileType === "application/pdf") {
      return this.extractTextFromPDF(file);
    } else if (fileType.startsWith("image/")) {
      return this.extractText(file);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Extract text from image URL
   */
  static async extractFromUrl(imageUrl: string): Promise<OCRResult> {
    return this.extractText(imageUrl);
  }

  /**
   * Terminate the worker to free up resources
   */
  static async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }

  /**
   * Extract structured data from receipt text
   * This is a helper method that uses regex patterns to find common receipt fields
   */
  static extractReceiptFields(text: string): {
    merchant?: string;
    date?: string;
    total?: number;
    tax?: number;
    items?: Array<{ description: string; amount: number }>;
  } {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

    // Try to find merchant name (usually first few lines)
    const merchant = lines[0] || undefined;

    // Try to find date (common patterns)
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
      /([A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})/,
    ];
    let date: string | undefined;
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        date = match[1];
        break;
      }
    }

    // Try to find total amount
    const totalPatterns = [
      /total[:\s]+\$?(\d+\.?\d*)/i,
      /amount[:\s]+\$?(\d+\.?\d*)/i,
      /grand\s+total[:\s]+\$?(\d+\.?\d*)/i,
    ];
    let total: number | undefined;
    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match) {
        total = parseFloat(match[1]);
        break;
      }
    }

    // Try to find tax amount
    const taxPatterns = [
      /tax[:\s]+\$?(\d+\.?\d*)/i,
      /vat[:\s]+\$?(\d+\.?\d*)/i,
      /gst[:\s]+\$?(\d+\.?\d*)/i,
    ];
    let tax: number | undefined;
    for (const pattern of taxPatterns) {
      const match = text.match(pattern);
      if (match) {
        tax = parseFloat(match[1]);
        break;
      }
    }

    // Try to extract line items (simplified)
    const items: Array<{ description: string; amount: number }> = [];
    const itemPattern = /(.+?)\s+\$?(\d+\.?\d*)\s*$/;
    for (const line of lines) {
      const match = line.match(itemPattern);
      if (match && !line.toLowerCase().includes("total") && !line.toLowerCase().includes("tax")) {
        const amount = parseFloat(match[2]);
        if (amount > 0 && amount < 10000) {
          // Reasonable item price
          items.push({
            description: match[1].trim(),
            amount,
          });
        }
      }
    }

    return {
      merchant,
      date,
      total,
      tax,
      items: items.length > 0 ? items : undefined,
    };
  }
}
