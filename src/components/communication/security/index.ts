/**
 * Communication Security Module
 * 
 * Exports all security-related functionality for the Communication Module:
 * - CSRF protection and token management
 * - Input sanitization
 * - Rate limiting
 * - File validation
 * - Secure API clients
 */

// CSRF Protection (Task 11.3)
export {
  generateCsrfToken,
  storeCsrfToken,
  getCsrfToken,
  initializeCsrfToken,
  validateCsrfToken,
  addCsrfHeader,
  getSecureWebSocketUrl,
  validateSession,
  tokenRefreshManager,
} from './csrfProtection';

// Secure API Clients (Task 11.3)
export {
  CommunicationApi,
  SecureSupabaseClient,
  communicationApi,
  secureSupabaseClient,
} from './communicationApi';
export type { ApiResponse, SecureRequestOptions } from './communicationApi';

// React Hooks (Task 11.3)
export {
  useCsrfProtection,
  useSecureMessages,
  useSecureChannels,
} from './useCsrfProtection';

// Input Sanitization (Task 11.1)
export {
  sanitizeInput,
  sanitizeHtml,
  sanitizeUrl,
  sanitizeFilename,
  escapeHtml,
  stripHtml,
  validateInput,
} from './inputSanitization';

// Rate Limiting (Task 11.2)
export {
  RateLimiter,
  MessageRateLimiter,
  FileUploadRateLimiter,
  messageRateLimiter,
  fileUploadRateLimiter,
} from './rateLimiter';
export type { RateLimitConfig, RateLimitResult } from './rateLimiter';

// File Validation (Task 11.4)
export {
  validateFileType,
  validateFileSize,
  validateMultipleFiles,
  validateFile,
  validateFiles,
  sanitizeFilename,
  scanFileForVirus,
  validateFileSecurely,
  isImageFile,
  isVideoFile,
  isDocumentFile,
  getFileCategory,
  formatFileSize,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
} from './fileValidation';
export type { VirusScanResult, VirusScanConfig } from './fileValidation';
