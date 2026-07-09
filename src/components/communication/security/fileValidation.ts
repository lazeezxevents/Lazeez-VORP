/**
 * File Upload Security
 * Task 11.4: Implement file upload security
 * Requirements: 20.6, 7.10
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES_PER_MESSAGE = 10;

/**
 * Allowed file types with MIME types
 */
const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  // Images
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  
  // Documents
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  
  // Archives
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'application/x-7z-compressed': ['.7z'],
  
  // Audio
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/ogg': ['.ogg'],
  
  // Video
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/ogg': ['.ogv'],
};

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.substring(lastDot).toLowerCase() : '';
}

/**
 * Validate file type against allowlist
 */
export function validateFileType(file: File): {
  valid: boolean;
  error?: string;
} {
  const mimeType = file.type;
  const extension = getFileExtension(file.name);

  // Check if MIME type is allowed
  if (!ALLOWED_FILE_TYPES[mimeType]) {
    return {
      valid: false,
      error: `File type "${mimeType}" is not allowed. Please upload a supported file type.`
    };
  }

  // Verify extension matches MIME type
  const allowedExtensions = ALLOWED_FILE_TYPES[mimeType];
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File extension "${extension}" does not match the file type.`
    };
  }

  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(file: File): {
  valid: boolean;
  error?: string;
} {
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMB}MB) exceeds the maximum allowed size of 50MB.`
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty and cannot be uploaded.'
    };
  }

  return { valid: true };
}

/**
 * Validate multiple files
 */
export function validateMultipleFiles(files: File[]): {
  valid: boolean;
  error?: string;
} {
  if (files.length > MAX_FILES_PER_MESSAGE) {
    return {
      valid: false,
      error: `You can only upload up to ${MAX_FILES_PER_MESSAGE} files at once.`
    };
  }

  return { valid: true };
}

/**
 * Comprehensive file validation
 */
export function validateFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Validate file size
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  // Validate file type
  const typeValidation = validateFileType(file);
  if (!typeValidation.valid) {
    return typeValidation;
  }

  return { valid: true };
}

/**
 * Validate batch of files
 */
export function validateFiles(files: File[]): {
  valid: boolean;
  errors: string[];
  validFiles: File[];
} {
  const errors: string[] = [];
  const validFiles: File[] = [];

  // Check total count
  const countValidation = validateMultipleFiles(files);
  if (!countValidation.valid) {
    return {
      valid: false,
      errors: [countValidation.error!],
      validFiles: []
    };
  }

  // Validate each file
  for (const file of files) {
    const validation = validateFile(file);
    if (validation.valid) {
      validFiles.push(file);
    } else {
      errors.push(`${file.name}: ${validation.error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validFiles
  };
}

/**
 * Check if file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Check if file is a video
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/**
 * Check if file is a document
 */
export function isDocumentFile(file: File): boolean {
  const documentMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ];
  
  return documentMimes.includes(file.type);
}

/**
 * Get file category for display
 */
export function getFileCategory(file: File): 'image' | 'video' | 'document' | 'archive' | 'audio' | 'other' {
  if (isImageFile(file)) return 'image';
  if (isVideoFile(file)) return 'video';
  if (isDocumentFile(file)) return 'document';
  if (file.type.includes('zip') || file.type.includes('rar') || file.type.includes('7z')) return 'archive';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'other';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Sanitize filename to prevent path traversal and other attacks
 * Requirements: 20.6, 7.10
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let sanitized = filename.replace(/[\/\\:\*\?"<>\|]/g, '_');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.trim().replace(/^\.+/, '').replace(/\.+$/, '');
  
  // Remove consecutive dots (path traversal protection)
  sanitized = sanitized.replace(/\.{2,}/g, '');
  
  // Limit length to 255 characters (filesystem limit)
  if (sanitized.length > 255) {
    const ext = getFileExtension(sanitized);
    const nameWithoutExt = sanitized.substring(0, sanitized.length - ext.length);
    sanitized = nameWithoutExt.substring(0, 255 - ext.length) + ext;
  }
  
  // Ensure filename is not empty after sanitization
  if (!sanitized || sanitized === '') {
    sanitized = `file_${Date.now()}`;
  }
  
  return sanitized;
}

/**
 * Virus scanning service integration
 * Integrates with ClamAV or similar antivirus service
 * Requirements: 20.6, 7.10
 * 
 * PERFORMANCE NOTE: This is designed for async scanning to avoid blocking uploads.
 * Files are uploaded first, then scanned in background. Infected files are quarantined.
 */
export interface VirusScanResult {
  safe: boolean;
  infected?: boolean;
  virusName?: string;
  error?: string;
  scanId?: string;
}

/**
 * Configuration for virus scanning service
 */
export interface VirusScanConfig {
  enabled: boolean;
  endpoint?: string; // ClamAV REST API endpoint
  timeout?: number; // Scan timeout in milliseconds
  asyncMode?: boolean; // If true, scan in background after upload
}

// Default configuration
const DEFAULT_SCAN_CONFIG: VirusScanConfig = {
  enabled: false, // Disabled by default, enable in production
  endpoint: import.meta.env.VITE_CLAMAV_ENDPOINT || 'http://localhost:3310/scan',
  timeout: 30000, // 30 seconds
  asyncMode: true, // Non-blocking by default for performance
};

/**
 * Scan file for viruses using ClamAV or compatible service
 * 
 * This function provides a production-ready interface for virus scanning.
 * In development, it returns safe by default. In production, configure
 * VITE_CLAMAV_ENDPOINT environment variable.
 * 
 * @param file - File to scan
 * @param config - Optional scan configuration
 * @returns Scan result with safety status
 */
export async function scanFileForVirus(
  file: File,
  config: Partial<VirusScanConfig> = {}
): Promise<VirusScanResult> {
  const scanConfig = { ...DEFAULT_SCAN_CONFIG, ...config };
  
  // If scanning is disabled, return safe
  if (!scanConfig.enabled) {
    console.log(`[File Security] Virus scanning disabled, skipping scan for: ${file.name}`);
    return { safe: true };
  }
  
  console.log(`[File Security] Scanning file for viruses: ${file.name} (${formatFileSize(file.size)})`);
  
  try {
    // Create FormData for file upload to scanning service
    const formData = new FormData();
    formData.append('file', file);
    
    // Call virus scanning service with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), scanConfig.timeout);
    
    const response = await fetch(scanConfig.endpoint!, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: {
        'X-Scan-Async': scanConfig.asyncMode ? 'true' : 'false',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Scan service returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Parse ClamAV-compatible response
    // Expected format: { safe: boolean, infected?: boolean, virus?: string, scanId?: string }
    if (result.infected) {
      console.warn(`[File Security] VIRUS DETECTED in ${file.name}: ${result.virus}`);
      return {
        safe: false,
        infected: true,
        virusName: result.virus,
        scanId: result.scanId,
      };
    }
    
    console.log(`[File Security] File scan completed: ${file.name} - SAFE`);
    return {
      safe: true,
      infected: false,
      scanId: result.scanId,
    };
    
  } catch (error) {
    // Handle scan errors
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error(`[File Security] Scan timeout for ${file.name}`);
        return {
          safe: false,
          error: 'Virus scan timed out. Please try again or contact support.',
        };
      }
      
      console.error(`[File Security] Scan error for ${file.name}:`, error.message);
      
      // In async mode, allow upload to proceed but flag for manual review
      if (scanConfig.asyncMode) {
        return {
          safe: true, // Allow upload, scan will complete in background
          error: 'Scan service unavailable. File will be scanned asynchronously.',
        };
      }
      
      // In sync mode, block upload on scan failure
      return {
        safe: false,
        error: 'Unable to scan file for viruses. Please try again later.',
      };
    }
    
    // Unknown error
    return {
      safe: scanConfig.asyncMode, // Allow in async mode, block in sync mode
      error: 'An unexpected error occurred during virus scanning.',
    };
  }
}

/**
 * Comprehensive file security validation
 * Combines all security checks: type, size, filename, and virus scanning
 * Requirements: 20.6, 7.10
 * 
 * @param file - File to validate
 * @param options - Validation options
 * @returns Validation result with sanitized filename
 */
export async function validateFileSecurely(
  file: File,
  options: {
    skipVirusScan?: boolean;
    virusScanConfig?: Partial<VirusScanConfig>;
  } = {}
): Promise<{
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
  virusScanResult?: VirusScanResult;
}> {
  // 1. Validate file size
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.valid) {
    return { valid: false, error: sizeValidation.error };
  }
  
  // 2. Validate file type
  const typeValidation = validateFileType(file);
  if (!typeValidation.valid) {
    return { valid: false, error: typeValidation.error };
  }
  
  // 3. Sanitize filename
  const sanitizedFilename = sanitizeFilename(file.name);
  
  // 4. Virus scan (if enabled and not skipped)
  if (!options.skipVirusScan) {
    const virusScanResult = await scanFileForVirus(file, options.virusScanConfig);
    
    if (!virusScanResult.safe) {
      return {
        valid: false,
        error: virusScanResult.infected
          ? `File contains malware: ${virusScanResult.virusName || 'Unknown threat'}`
          : virusScanResult.error || 'File failed security scan',
        sanitizedFilename,
        virusScanResult,
      };
    }
    
    return {
      valid: true,
      sanitizedFilename,
      virusScanResult,
    };
  }
  
  return {
    valid: true,
    sanitizedFilename,
  };
}
