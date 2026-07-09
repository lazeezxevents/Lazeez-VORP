/**
 * Receipt OCR Service
 * Task 22.1: Integrate Tesseract.js for OCR
 * Requirements: 10.3
 * 
 * Performs optical character recognition on receipt images
 * using Tesseract.js to extract text data.
 */

import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  success: boolean;
  error?: string;
}

export class ReceiptOCRService {
  private worker: Tesseract.Worker | null = null;

  /**
   * Initialize Tesseract worker
   */
  private async initializeWorker(): Promise<Tesseract.Worker> {
    if (this.worker) {
      return this.worker;
    }

    try {
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          // Log progress for debugging
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      this.worker = worker;
      return worker;
    } catch (error) {
      console.error('Failed to initialize Tesseract worker:', error);
      throw new Error('OCR initialization failed');
    }
  }

  /**
   * Extract text from receipt image using OCR
   * Requirements: 10.3
   */
  async extractText(imageUrl: string): Promise<OCRResult> {
    try {
      // Initialize worker
      const worker = await this.initializeWorker();

      // Perform OCR
      const { data } = await worker.recognize(imageUrl);

      // Calculate average confidence
      const confidence = data.confidence || 0;

      return {
        text: data.text,
        confidence,
        success: true,
      };
    } catch (error) {
      console.error('OCR extraction failed:', error);
      return {
        text: '',
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract text from file blob
   */
  async extractTextFromFile(file: File): Promise<OCRResult> {
    try {
      // Convert file to data URL
      const dataUrl = await this.fileToDataUrl(file);
      
      // Perform OCR
      return await this.extractText(dataUrl);
    } catch (error) {
      console.error('OCR extraction from file failed:', error);
      return {
        text: '',
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert file to data URL
   */
  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Terminate worker to free resources
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Process receipt image with preprocessing for better OCR results
   */
  async extractTextWithPreprocessing(imageUrl: string): Promise<OCRResult> {
    try {
      const worker = await this.initializeWorker();

      // Perform OCR with preprocessing options
      const { data } = await worker.recognize(imageUrl, {
        rotateAuto: true, // Auto-rotate image
      });

      const confidence = data.confidence || 0;

      return {
        text: data.text,
        confidence,
        success: true,
      };
    } catch (error) {
      console.error('OCR extraction with preprocessing failed:', error);
      return {
        text: '',
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const receiptOCRService = new ReceiptOCRService();
