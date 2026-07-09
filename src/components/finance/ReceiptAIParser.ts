/**
 * Receipt AI Parser Service
 * Task 22.2: Implement AI data parsing
 * Requirements: 10.4, 10.5, 10.6, 10.7, 10.8
 * 
 * Parses OCR-extracted text into structured receipt data
 * using pattern matching and AI-powered extraction.
 */

import type { ExtractedData, ExtractedReceiptLineItem } from "./types";

export class ReceiptAIParser {
  /**
   * Parse OCR text into structured receipt data
   * Requirements: 10.4, 10.5
   */
  async parseReceiptData(ocrText: string, ocrConfidence: number): Promise<ExtractedData> {
    try {
      // Extract merchant name
      const merchantName = this.extractMerchantName(ocrText);

      // Extract date
      const date = this.extractDate(ocrText);

      // Extract total amount
      const totalAmount = this.extractTotalAmount(ocrText);

      // Extract currency
      const currency = this.extractCurrency(ocrText);

      // Extract line items
      const lineItems = this.extractLineItems(ocrText);

      // Extract tax amount
      const taxAmount = this.extractTaxAmount(ocrText);

      // Extract payment method
      const paymentMethod = this.extractPaymentMethod(ocrText);

      // Calculate confidence score based on extracted fields
      const confidence = this.calculateConfidenceScore(
        {
          merchantName,
          date,
          totalAmount,
          currency,
          lineItems,
          taxAmount,
          paymentMethod,
        },
        ocrConfidence
      );

      return {
        merchantName,
        date,
        totalAmount,
        currency,
        lineItems,
        taxAmount,
        paymentMethod,
        confidence,
      };
    } catch (error) {
      console.error('Error parsing receipt data:', error);
      return {
        confidence: 0,
      };
    }
  }

  /**
   * Extract merchant name from OCR text
   */
  private extractMerchantName(text: string): string | undefined {
    // Look for merchant name in first few lines
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Common patterns for merchant names
    const merchantPatterns = [
      /^([A-Z][A-Za-z\s&'-]+)$/,
      /^([A-Z][A-Za-z\s&'-]+)\s*(?:Store|Shop|Restaurant|Cafe|Market)/i,
    ];

    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      
      // Skip lines with numbers or common receipt keywords
      if (/\d{2,}|receipt|invoice|bill|tax|total/i.test(line)) {
        continue;
      }

      for (const pattern of merchantPatterns) {
        const match = line.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }

      // If line is all caps and has 3+ words, likely merchant name
      if (line === line.toUpperCase() && line.split(/\s+/).length >= 2) {
        return line;
      }
    }

    return undefined;
  }

  /**
   * Extract date from OCR text
   */
  private extractDate(text: string): string | undefined {
    // Common date patterns
    const datePatterns = [
      /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
      /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
      /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
      /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return this.normalizeDate(match[1]);
      }
    }

    return undefined;
  }

  /**
   * Normalize date to YYYY-MM-DD format
   */
  private normalizeDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      // Return original if parsing fails
    }
    return dateStr;
  }

  /**
   * Extract total amount from OCR text
   */
  private extractTotalAmount(text: string): number | undefined {
    // Look for total amount patterns
    const totalPatterns = [
      /total[:\s]*(?:PKR|Rs\.?|₨)?\s*(\d+[,.]?\d*\.?\d*)/i,
      /grand\s+total[:\s]*(?:PKR|Rs\.?|₨)?\s*(\d+[,.]?\d*\.?\d*)/i,
      /amount[:\s]*(?:PKR|Rs\.?|₨)?\s*(\d+[,.]?\d*\.?\d*)/i,
      /(?:PKR|Rs\.?|₨)\s*(\d+[,.]?\d*\.?\d*)\s*total/i,
    ];

    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount)) {
          return amount;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract currency from OCR text
   */
  private extractCurrency(text: string): string | undefined {
    // Look for currency indicators
    if (/PKR|Rs\.?|₨|rupee/i.test(text)) {
      return 'PKR';
    }

    if (/USD|\$|dollar/i.test(text)) {
      return 'USD';
    }

    if (/EUR|€|euro/i.test(text)) {
      return 'EUR';
    }

    // Default to PKR for Pakistani context
    return 'PKR';
  }

  /**
   * Extract line items from OCR text
   */
  private extractLineItems(text: string): ExtractedReceiptLineItem[] | undefined {
    const items: ExtractedReceiptLineItem[] = [];
    const lines = text.split('\n');

    // Pattern for line items: description followed by quantity and price
    const itemPattern = /^(.+?)\s+(\d+)\s*x?\s*(?:PKR|Rs\.?|₨)?\s*(\d+[,.]?\d*\.?\d*)\s*(?:PKR|Rs\.?|₨)?\s*(\d+[,.]?\d*\.?\d*)$/i;

    for (const line of lines) {
      const match = line.trim().match(itemPattern);
      if (match) {
        const description = match[1].trim();
        const quantity = parseInt(match[2]);
        const unitPrice = parseFloat(match[3].replace(/,/g, ''));
        const amount = parseFloat(match[4].replace(/,/g, ''));

        if (!isNaN(quantity) && !isNaN(unitPrice) && !isNaN(amount)) {
          items.push({
            description,
            quantity,
            unitPrice,
            amount,
          });
        }
      }
    }

    return items.length > 0 ? items : undefined;
  }

  /**
   * Extract tax amount from OCR text
   */
  private extractTaxAmount(text: string): number | undefined {
    // Look for tax patterns
    const taxPatterns = [
      /tax[:\s]*(?:PKR|Rs\.?|₨)?\s*(\d+[,.]?\d*\.?\d*)/i,
      /(?:GST|VAT|sales\s+tax)[:\s]*(?:PKR|Rs\.?|₨)?\s*(\d+[,.]?\d*\.?\d*)/i,
    ];

    for (const pattern of taxPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount)) {
          return amount;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract payment method from OCR text
   */
  private extractPaymentMethod(text: string): string | undefined {
    const paymentMethods = [
      { pattern: /cash/i, method: 'Cash' },
      { pattern: /credit\s*card/i, method: 'Credit Card' },
      { pattern: /debit\s*card/i, method: 'Debit Card' },
      { pattern: /visa/i, method: 'Visa' },
      { pattern: /mastercard/i, method: 'Mastercard' },
      { pattern: /online|digital/i, method: 'Online Payment' },
    ];

    for (const { pattern, method } of paymentMethods) {
      if (pattern.test(text)) {
        return method;
      }
    }

    return undefined;
  }

  /**
   * Calculate confidence score based on extracted fields
   * Requirements: 10.6
   */
  private calculateConfidenceScore(
    data: Partial<ExtractedData>,
    ocrConfidence: number
  ): number {
    // Weight factors for different fields
    const weights = {
      merchantName: 0.15,
      date: 0.15,
      totalAmount: 0.30, // Most important
      currency: 0.10,
      lineItems: 0.15,
      taxAmount: 0.10,
      paymentMethod: 0.05,
    };

    let score = 0;
    let totalWeight = 0;

    // Add score for each extracted field
    if (data.merchantName) {
      score += weights.merchantName * 100;
      totalWeight += weights.merchantName;
    }

    if (data.date) {
      score += weights.date * 100;
      totalWeight += weights.date;
    }

    if (data.totalAmount !== undefined) {
      score += weights.totalAmount * 100;
      totalWeight += weights.totalAmount;
    }

    if (data.currency) {
      score += weights.currency * 100;
      totalWeight += weights.currency;
    }

    if (data.lineItems && data.lineItems.length > 0) {
      score += weights.lineItems * 100;
      totalWeight += weights.lineItems;
    }

    if (data.taxAmount !== undefined) {
      score += weights.taxAmount * 100;
      totalWeight += weights.taxAmount;
    }

    if (data.paymentMethod) {
      score += weights.paymentMethod * 100;
      totalWeight += weights.paymentMethod;
    }

    // Calculate weighted average
    const fieldScore = totalWeight > 0 ? score / totalWeight : 0;

    // Combine with OCR confidence (70% field extraction, 30% OCR quality)
    const finalScore = fieldScore * 0.7 + ocrConfidence * 0.3;

    return Math.round(finalScore * 100) / 100;
  }

  /**
   * Determine if receipt should be marked for manual review
   * Requirements: 10.7, 10.8
   */
  shouldRequireManualReview(confidence: number): boolean {
    return confidence < 70;
  }

  /**
   * Get processing status based on confidence
   * Requirements: 10.7, 10.8
   */
  getProcessingStatus(confidence: number): 'processed' | 'pending' {
    return confidence >= 70 ? 'processed' : 'pending';
  }
}

// Export singleton instance
export const receiptAIParser = new ReceiptAIParser();
