import { OCRService } from "./OCRService";
import type { ExtractedData, LineItem } from "@/types/receipt";

export interface ParsedReceiptData extends ExtractedData {
  raw_text: string;
}

export class ReceiptParser {
  /**
   * Parse receipt data from OCR text using AI/pattern matching
   */
  static async parseReceipt(file: File): Promise<ParsedReceiptData> {
    // Step 1: Extract text using OCR
    const ocrResult = await OCRService.extractFromFile(file);

    // Step 2: Extract structured fields from text
    const fields = OCRService.extractReceiptFields(ocrResult.text);

    // Step 3: Parse and structure the data
    const extractedData: ParsedReceiptData = {
      merchant_name: fields.merchant,
      transaction_date: fields.date ? this.parseDate(fields.date) : undefined,
      total_amount: fields.total,
      tax_amount: fields.tax,
      currency: "PKR", // Default currency
      line_items: fields.items?.map((item) => ({
        description: item.description,
        amount: item.amount,
      })),
      confidence_score: ocrResult.confidence,
      raw_text: ocrResult.text,
    };

    // Step 4: Enhance with AI parsing if available
    const enhancedData = await this.enhanceWithAI(ocrResult.text, extractedData);

    return enhancedData;
  }

  /**
   * Enhance extracted data using AI (placeholder for future AI integration)
   */
  private static async enhanceWithAI(
    rawText: string,
    baseData: ParsedReceiptData
  ): Promise<ParsedReceiptData> {
    // This is a placeholder for AI enhancement
    // In production, this would call an AI service (OpenAI, Claude, etc.)
    // to extract more accurate data from the receipt text

    // For now, we'll use advanced pattern matching and heuristics
    const enhanced = { ...baseData };

    // Try to extract merchant address
    enhanced.merchant_address = this.extractAddress(rawText);

    // Try to extract payment method
    enhanced.payment_method = this.extractPaymentMethod(rawText);

    // Try to extract invoice number
    enhanced.invoice_number = this.extractInvoiceNumber(rawText);

    // Recalculate confidence based on how many fields we extracted
    enhanced.confidence_score = this.calculateConfidence(enhanced);

    return enhanced;
  }

  /**
   * Extract address from text
   */
  private static extractAddress(text: string): string | undefined {
    // Look for address patterns
    const addressPatterns = [
      /address[:\s]+(.+?)(?:\n|$)/i,
      /(\d+\s+[A-Za-z\s]+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr)[,\s]+[A-Za-z\s]+)/i,
    ];

    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract payment method from text
   */
  private static extractPaymentMethod(text: string): string | undefined {
    const paymentMethods = ["cash", "credit card", "debit card", "visa", "mastercard", "amex", "paypal"];

    const lowerText = text.toLowerCase();
    for (const method of paymentMethods) {
      if (lowerText.includes(method)) {
        return method.charAt(0).toUpperCase() + method.slice(1);
      }
    }

    return undefined;
  }

  /**
   * Extract invoice/receipt number from text
   */
  private static extractInvoiceNumber(text: string): string | undefined {
    const invoicePatterns = [
      /invoice\s*#?\s*[:\s]*([A-Z0-9-]+)/i,
      /receipt\s*#?\s*[:\s]*([A-Z0-9-]+)/i,
      /order\s*#?\s*[:\s]*([A-Z0-9-]+)/i,
      /#\s*([A-Z0-9-]{5,})/,
    ];

    for (const pattern of invoicePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Parse date string to ISO format
   */
  private static parseDate(dateStr: string): string | undefined {
    try {
      // Try to parse various date formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0]; // Return YYYY-MM-DD
      }
    } catch (error) {
      console.error("Failed to parse date:", dateStr);
    }

    return undefined;
  }

  /**
   * Calculate confidence score based on extracted fields
   */
  private static calculateConfidence(data: ParsedReceiptData): number {
    let score = data.confidence_score || 0;
    let fieldCount = 0;
    let extractedCount = 0;

    // Check critical fields
    const criticalFields = [
      "merchant_name",
      "transaction_date",
      "total_amount",
    ];

    for (const field of criticalFields) {
      fieldCount++;
      if (data[field as keyof ParsedReceiptData]) {
        extractedCount++;
      }
    }

    // Check optional fields
    const optionalFields = [
      "tax_amount",
      "merchant_address",
      "payment_method",
      "invoice_number",
      "line_items",
    ];

    for (const field of optionalFields) {
      fieldCount++;
      if (data[field as keyof ParsedReceiptData]) {
        extractedCount++;
      }
    }

    // Combine OCR confidence with field extraction success
    const fieldScore = (extractedCount / fieldCount) * 100;
    const finalScore = (score * 0.4 + fieldScore * 0.6);

    return Math.round(finalScore);
  }

  /**
   * Validate extracted data
   */
  static validateExtractedData(data: ParsedReceiptData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check critical fields
    if (!data.merchant_name) {
      errors.push("Merchant name not found");
    }

    if (!data.transaction_date) {
      errors.push("Transaction date not found");
    }

    if (!data.total_amount || data.total_amount <= 0) {
      errors.push("Valid total amount not found");
    }

    // Check if tax amount is reasonable (if present)
    if (data.tax_amount && data.total_amount) {
      if (data.tax_amount > data.total_amount) {
        errors.push("Tax amount exceeds total amount");
      }
    }

    // Check line items sum (if present)
    if (data.line_items && data.line_items.length > 0 && data.total_amount) {
      const itemsSum = data.line_items.reduce((sum, item) => sum + item.amount, 0);
      const difference = Math.abs(itemsSum - data.total_amount);
      
      // Allow 10% difference for rounding and missing items
      if (difference > data.total_amount * 0.1) {
        errors.push("Line items sum does not match total amount");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Determine if receipt needs manual review based on confidence and validation
   */
  static needsManualReview(data: ParsedReceiptData): boolean {
    // Low confidence threshold
    if (data.confidence_score < 70) {
      return true;
    }

    // Validation failed
    const validation = this.validateExtractedData(data);
    if (!validation.isValid) {
      return true;
    }

    // Missing critical fields
    if (!data.merchant_name || !data.transaction_date || !data.total_amount) {
      return true;
    }

    return false;
  }
}
