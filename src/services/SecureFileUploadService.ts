/**
 * Secure File Upload Service
 * Task 11.4: Implement file upload security
 * 
 * This service provides a secure file upload pipeline with:
 * - File type validation against allowlist
 * - File size validation
 * - Filename sanitization
 * - Virus scanning integration (async)
 * - Rate limiting
 * - Audit logging
 * 
 * Requirements: 20.6, 7.10, 7.1, 7.2, 7.3
 * 
 * PERFORMANCE: Designed for near-zero latency impact on real-time communication.
 * Virus scanning runs asynchronously after upload to avoid blocking.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  validateFileSecurely,
  sanitizeFilename,
  formatFileSize,
  type VirusScanConfig,
  type VirusScanResult,
} from '@/components/communication/security/fileValidation';
import { RateLimiterService } from './RateLimiterService';
import { CommunicationAuditService } from './CommunicationAuditService';

/**
 * File upload result
 */
export interface FileUploadResult {
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  sanitizedFilename?: string;
  thumbnailUrl?: string;
  error?: string;
  virusScanResult?: VirusScanResult;
}

/**
 * File upload options
 */
export interface FileUploadOptions {
  userId: string;
  channelId?: string;
  messageId?: string;
  bucket?: string;
  skipVirusScan?: boolean;
  virusScanConfig?: Partial<VirusScanConfig>;
  generateThumbnail?: boolean;
}

/**
 * Secure File Upload Service
 */
export class SecureFileUploadService {
  private static readonly DEFAULT_BUCKET = 'communication-files';
  private static readonly THUMBNAIL_BUCKET = 'communication-thumbnails';
  
  /**
   * Upload a file securely with all security checks
   * 
   * @param file - File to upload
   * @param options - Upload options
   * @returns Upload result
   */
  static async uploadFile(
    file: File,
    options: FileUploadOptions
  ): Promise<FileUploadResult> {
    const startTime = Date.now();
    
    try {
      // 1. Check rate limit (Requirement 20.5)
      const rateLimitResult = await RateLimiterService.checkFileUploadRateLimit(options.userId);
      if (!rateLimitResult.allowed) {
        const retrySeconds = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000);
        return {
          success: false,
          error: `Rate limit exceeded. Please wait ${retrySeconds} seconds before uploading again.`,
        };
      }
      
      // 2. Validate file securely (type, size, filename, virus scan)
      console.log(`[Secure Upload] Validating file: ${file.name} (${formatFileSize(file.size)})`);
      
      const validation = await validateFileSecurely(file, {
        skipVirusScan: options.skipVirusScan,
        virusScanConfig: options.virusScanConfig,
      });
      
      if (!validation.valid) {
        console.error(`[Secure Upload] Validation failed: ${validation.error}`);
        return {
          success: false,
          error: validation.error,
          virusScanResult: validation.virusScanResult,
        };
      }
      
      const sanitizedFilename = validation.sanitizedFilename!;
      console.log(`[Secure Upload] File validated successfully. Sanitized filename: ${sanitizedFilename}`);
      
      // 3. Generate unique file path
      const timestamp = Date.now();
      const bucket = options.bucket || this.DEFAULT_BUCKET;
      const filePath = `${options.userId}/${timestamp}_${sanitizedFilename}`;
      
      // 4. Upload to Supabase Storage
      console.log(`[Secure Upload] Uploading to storage: ${bucket}/${filePath}`);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (uploadError) {
        console.error(`[Secure Upload] Upload failed:`, uploadError);
        return {
          success: false,
          error: `Upload failed: ${uploadError.message}`,
        };
      }
      
      // 5. Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(uploadData.path);
      
      const fileUrl = urlData.publicUrl;
      
      // 6. Generate thumbnail for images (if requested)
      let thumbnailUrl: string | undefined;
      if (options.generateThumbnail && file.type.startsWith('image/')) {
        thumbnailUrl = await this.generateThumbnail(file, options.userId);
      }
      
      // 7. Log upload event (Requirement 18.5)
      if (options.messageId) {
        await CommunicationAuditService.logFileUploaded(
          options.userId,
          options.messageId,
          sanitizedFilename,
          file.size,
          file.type
        );
      }
      
      const uploadTime = Date.now() - startTime;
      console.log(`[Secure Upload] Upload completed in ${uploadTime}ms: ${fileUrl}`);
      
      return {
        success: true,
        fileUrl,
        fileName: sanitizedFilename,
        fileSize: file.size,
        fileType: file.type,
        sanitizedFilename,
        thumbnailUrl,
        virusScanResult: validation.virusScanResult,
      };
      
    } catch (error) {
      console.error(`[Secure Upload] Unexpected error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred during upload',
      };
    }
  }
  
  /**
   * Upload multiple files securely
   * 
   * @param files - Files to upload
   * @param options - Upload options
   * @returns Array of upload results
   */
  static async uploadFiles(
    files: File[],
    options: FileUploadOptions
  ): Promise<FileUploadResult[]> {
    console.log(`[Secure Upload] Uploading ${files.length} files`);
    
    // Upload files in parallel for performance
    const uploadPromises = files.map(file => this.uploadFile(file, options));
    const results = await Promise.all(uploadPromises);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`[Secure Upload] Batch upload completed: ${successCount}/${files.length} successful`);
    
    return results;
  }
  
  /**
   * Generate thumbnail for image files
   * 
   * @param file - Image file
   * @param userId - User ID
   * @returns Thumbnail URL or undefined
   */
  private static async generateThumbnail(
    file: File,
    userId: string
  ): Promise<string | undefined> {
    try {
      // Create thumbnail using canvas
      const img = await this.loadImage(file);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return undefined;
      
      // Calculate thumbnail dimensions (max 200x200, maintain aspect ratio)
      const maxSize = 200;
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.8);
      });
      
      if (!blob) return undefined;
      
      // Upload thumbnail
      const timestamp = Date.now();
      const sanitizedName = sanitizeFilename(file.name);
      const thumbnailPath = `${userId}/${timestamp}_thumb_${sanitizedName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(this.THUMBNAIL_BUCKET)
        .upload(thumbnailPath, blob, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (uploadError) {
        console.error(`[Secure Upload] Thumbnail upload failed:`, uploadError);
        return undefined;
      }
      
      const { data: urlData } = supabase.storage
        .from(this.THUMBNAIL_BUCKET)
        .getPublicUrl(uploadData.path);
      
      return urlData.publicUrl;
      
    } catch (error) {
      console.error(`[Secure Upload] Thumbnail generation failed:`, error);
      return undefined;
    }
  }
  
  /**
   * Load image from file
   */
  private static loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  
  /**
   * Delete a file from storage
   * 
   * @param filePath - Path to file in storage
   * @param bucket - Storage bucket
   * @returns Success status
   */
  static async deleteFile(
    filePath: string,
    bucket: string = this.DEFAULT_BUCKET
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file',
      };
    }
  }
  
  /**
   * Check if virus scanning is enabled
   */
  static isVirusScanningEnabled(): boolean {
    return !!import.meta.env.VITE_CLAMAV_ENDPOINT;
  }
  
  /**
   * Get virus scanning configuration
   */
  static getVirusScanConfig(): VirusScanConfig {
    return {
      enabled: this.isVirusScanningEnabled(),
      endpoint: import.meta.env.VITE_CLAMAV_ENDPOINT,
      timeout: 30000,
      asyncMode: true, // Always async for performance
    };
  }
}
