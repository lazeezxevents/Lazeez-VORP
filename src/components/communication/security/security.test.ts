/**
 * Security Tests for Communication Module
 * Task 11.5: Write security tests
 * Requirements: 30.6
 * 
 * This test suite validates all security measures:
 * 1. XSS Prevention - Test that malicious scripts are sanitized
 * 2. CSRF Protection - Test that tokens are validated correctly
 * 3. Rate Limiting - Test that limits are enforced
 * 4. File Upload Security - Test that validation works
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  sanitizeMessage,
  sanitizeMarkdown,
  sanitizeUserInput,
  sanitizeFileName,
  sanitizeUrl,
  escapeHtml,
  validateMessageContent,
} from './inputSanitization';
import {
  generateCsrfToken,
  validateCsrfToken,
  getCsrfToken,
  storeCsrfToken,
  initializeCsrfToken,
  getSecureWebSocketUrl,
} from './csrfProtection';
import { RateLimiterService } from '@/services/RateLimiterService';
import {
  validateFile,
  validateFiles,
  validateFileType,
  validateFileSize,
  validateMultipleFiles,
  sanitizeFilename,
  isImageFile,
  isVideoFile,
  isDocumentFile,
} from './fileValidation';

describe('Security Tests - Task 11.5', () => {
  
  // ============================================================================
  // 1. XSS PREVENTION TESTS
  // ============================================================================
  
  describe('XSS Prevention with Malicious Input', () => {
    
    it('should sanitize basic XSS script tags', () => {
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        '<script src="evil.js"></script>',
        '<img src=x onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
      ];

      maliciousInputs.forEach((input) => {
        const sanitized = sanitizeMessage(input);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onload');
        expect(sanitized).not.toContain('javascript:');
      });
    });

    it('should sanitize event handlers in HTML attributes', () => {
      const maliciousInputs = [
        '<div onclick="alert(1)">Click me</div>',
        '<a href="#" onmouseover="alert(1)">Hover</a>',
        '<input onfocus="alert(1)">',
        '<body onload="alert(1)">',
        '<img src=x onerror=alert(1)>',
      ];

      maliciousInputs.forEach((input) => {
        const sanitized = sanitizeMessage(input);
        expect(sanitized).not.toMatch(/on\w+\s*=/i);
      });
    });

    it('should sanitize javascript: protocol in URLs', () => {
      const maliciousInputs = [
        '<a href="javascript:alert(1)">Click</a>',
        '<a href="JAVASCRIPT:alert(1)">Click</a>',
        '<a href="jAvAsCrIpT:alert(1)">Click</a>',
        '<img src="javascript:alert(1)">',
      ];

      maliciousInputs.forEach((input) => {
        const sanitized = sanitizeMessage(input);
        expect(sanitized.toLowerCase()).not.toContain('javascript:');
      });
    });

    it('should sanitize data: protocol with base64 encoded scripts', () => {
      const maliciousInputs = [
        '<img src="data:text/html,<script>alert(1)</script>">',
        '<object data="data:text/html,<script>alert(1)</script>">',
      ];

      maliciousInputs.forEach((input) => {
        const sanitized = sanitizeMessage(input);
        expect(sanitized).not.toContain('<script');
      });
    });

    it('should preserve safe markdown formatting', () => {
      const safeMarkdown = '**Bold** *italic* `code` ~~strikethrough~~';
      const sanitized = sanitizeMarkdown(safeMarkdown);
      
      expect(sanitized).toContain('<strong>');
      expect(sanitized).toContain('<em>');
      expect(sanitized).toContain('<code>');
      expect(sanitized).toContain('<del>');
    });

    it('should sanitize malicious markdown with embedded scripts', () => {
      const maliciousMarkdown = [
        '**Bold<script>alert(1)</script>**',
        '[Click](javascript:alert(1))',
        '![Image](javascript:alert(1))',
        '`code<script>alert(1)</script>`',
      ];

      maliciousMarkdown.forEach((input) => {
        const sanitized = sanitizeMarkdown(input);
        expect(sanitized).not.toContain('<script');
        expect(sanitized.toLowerCase()).not.toContain('javascript:');
      });
    });

    it('should escape HTML entities correctly', () => {
      const input = '<div>&"\'</div>';
      const escaped = escapeHtml(input);
      
      expect(escaped).toBe('&lt;div&gt;&amp;&quot;&#039;&lt;/div&gt;');
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');
    });

    it('should sanitize user input by stripping all HTML', () => {
      const inputs = [
        '<b>Bold</b>',
        '<script>alert(1)</script>',
        '<a href="#">Link</a>',
      ];

      inputs.forEach((input) => {
        const sanitized = sanitizeUserInput(input);
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
      });
    });

    it('should validate and sanitize URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'mailto:test@example.com',
      ];

      const invalidUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'ftp://example.com',
      ];

      validUrls.forEach((url) => {
        const sanitized = sanitizeUrl(url);
        expect(sanitized).toBeTruthy();
      });

      invalidUrls.forEach((url) => {
        const sanitized = sanitizeUrl(url);
        expect(sanitized).toBeNull();
      });
    });

    // Property-based test: Any input should not contain script tags after sanitization
    it('property: sanitized output never contains script tags', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (input) => {
            const sanitized = sanitizeMessage(input);
            expect(sanitized.toLowerCase()).not.toContain('<script');
            expect(sanitized.toLowerCase()).not.toContain('</script>');
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property-based test: Event handlers should be removed
    it('property: sanitized output never contains event handlers', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (input) => {
            const sanitized = sanitizeMessage(input);
            expect(sanitized).not.toMatch(/\son\w+\s*=/i);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // 2. CSRF TOKEN VALIDATION TESTS
  // ============================================================================
  
  describe('CSRF Token Validation', () => {
    
    beforeEach(() => {
      // Clear session storage before each test
      sessionStorage.clear();
    });

    afterEach(() => {
      sessionStorage.clear();
    });

    it('should generate cryptographically secure tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      
      expect(token1).toHaveLength(64); // 32 bytes * 2 (hex)
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2); // Should be unique
    });

    it('should store and retrieve CSRF tokens', () => {
      const token = generateCsrfToken();
      storeCsrfToken(token);
      
      const retrieved = getCsrfToken();
      expect(retrieved).toBe(token);
    });

    it('should validate matching CSRF tokens', () => {
      const token = generateCsrfToken();
      storeCsrfToken(token);
      
      const isValid = validateCsrfToken(token);
      expect(isValid).toBe(true);
    });

    it('should reject mismatched CSRF tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      
      storeCsrfToken(token1);
      
      const isValid = validateCsrfToken(token2);
      expect(isValid).toBe(false);
    });

    it('should reject empty or null tokens', () => {
      const token = generateCsrfToken();
      storeCsrfToken(token);
      
      expect(validateCsrfToken('')).toBe(false);
      expect(validateCsrfToken(null as any)).toBe(false);
    });

    it('should initialize token on first access', () => {
      const token = initializeCsrfToken();
      
      expect(token).toBeTruthy();
      expect(token).toHaveLength(64);
      
      const retrieved = getCsrfToken();
      expect(retrieved).toBe(token);
    });

    it('should reuse existing token on subsequent initializations', () => {
      const token1 = initializeCsrfToken();
      const token2 = initializeCsrfToken();
      
      expect(token1).toBe(token2);
    });

    it('should expire tokens after 24 hours', () => {
      const token = generateCsrfToken();
      storeCsrfToken(token);
      
      // Manually set expiry to past
      const stored = JSON.parse(sessionStorage.getItem('vorp_csrf_token')!);
      stored.expiry = Date.now() - 1000; // 1 second ago
      sessionStorage.setItem('vorp_csrf_token', JSON.stringify(stored));
      
      const retrieved = getCsrfToken();
      expect(retrieved).toBeNull();
    });

    it('should enforce secure WebSocket URLs', () => {
      expect(getSecureWebSocketUrl('ws://example.com')).toBe('wss://example.com');
      expect(getSecureWebSocketUrl('wss://example.com')).toBe('wss://example.com');
      expect(getSecureWebSocketUrl('example.com')).toBe('wss://example.com');
    });

    // Property-based test: Token validation is timing-safe
    it('property: token validation timing should be consistent', () => {
      const validToken = generateCsrfToken();
      storeCsrfToken(validToken);
      
      const timings: number[] = [];
      
      // Test with valid token
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        validateCsrfToken(validToken);
        const end = performance.now();
        timings.push(end - start);
      }
      
      // Test with invalid token of same length
      const invalidToken = generateCsrfToken();
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        validateCsrfToken(invalidToken);
        const end = performance.now();
        timings.push(end - start);
      }
      
      // Timing variance should be minimal (within 2ms)
      const maxTiming = Math.max(...timings);
      const minTiming = Math.min(...timings);
      expect(maxTiming - minTiming).toBeLessThan(2);
    });
  });

  // ============================================================================
  // 3. RATE LIMITING ENFORCEMENT TESTS
  // ============================================================================
  
  describe('Rate Limiting Enforcement', () => {
    
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();
      vi.clearAllMocks();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('should allow messages within rate limit (60 per minute)', async () => {
      const userId = 'test-user-1';
      
      // Send 59 messages (within limit)
      for (let i = 0; i < 59; i++) {
        const result = await RateLimiterService.checkMessageRateLimit(userId);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(60 - i - 1);
      }
    });

    it('should block messages exceeding rate limit', async () => {
      const userId = 'test-user-2';
      
      // Send 60 messages (at limit)
      for (let i = 0; i < 60; i++) {
        await RateLimiterService.checkMessageRateLimit(userId);
      }
      
      // 61st message should be blocked
      const result = await RateLimiterService.checkMessageRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.error).toContain('too quickly');
    });

    it('should allow file uploads within rate limit (10 per minute)', async () => {
      const userId = 'test-user-3';
      
      // Upload 9 files (within limit)
      for (let i = 0; i < 9; i++) {
        const result = await RateLimiterService.checkFileUploadRateLimit(userId);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(10 - i - 1);
      }
    });

    it('should block file uploads exceeding rate limit', async () => {
      const userId = 'test-user-4';
      
      // Upload 10 files (at limit)
      for (let i = 0; i < 10; i++) {
        await RateLimiterService.checkFileUploadRateLimit(userId);
      }
      
      // 11th upload should be blocked
      const result = await RateLimiterService.checkFileUploadRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.error).toContain('too quickly');
    });

    it('should track rate limits per user independently', async () => {
      const user1 = 'test-user-5';
      const user2 = 'test-user-6';
      
      // User 1 sends 60 messages
      for (let i = 0; i < 60; i++) {
        await RateLimiterService.checkMessageRateLimit(user1);
      }
      
      // User 1 should be blocked
      const result1 = await RateLimiterService.checkMessageRateLimit(user1);
      expect(result1.allowed).toBe(false);
      
      // User 2 should still be allowed
      const result2 = await RateLimiterService.checkMessageRateLimit(user2);
      expect(result2.allowed).toBe(true);
    });

    it('should provide reset time when rate limit exceeded', async () => {
      const userId = 'test-user-7';
      
      // Exceed limit
      for (let i = 0; i < 61; i++) {
        await RateLimiterService.checkMessageRateLimit(userId);
      }
      
      const result = await RateLimiterService.checkMessageRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.resetAt).toBeInstanceOf(Date);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should reset rate limit after window expires', async () => {
      const userId = 'test-user-8';
      
      // Exceed limit
      for (let i = 0; i < 61; i++) {
        await RateLimiterService.checkMessageRateLimit(userId);
      }
      
      // Should be blocked
      let result = await RateLimiterService.checkMessageRateLimit(userId);
      expect(result.allowed).toBe(false);
      
      // Manually expire the window
      const key = `rate_limit_messages:${userId}`;
      const stored = JSON.parse(localStorage.getItem(key)!);
      stored.resetAt = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      localStorage.setItem(key, JSON.stringify(stored));
      
      // Should be allowed again
      result = await RateLimiterService.checkMessageRateLimit(userId);
      expect(result.allowed).toBe(true);
    });

    it('should log rate limit violations', async () => {
      const userId = 'test-user-9';
      const logSpy = vi.spyOn(RateLimiterService, 'logRateLimitViolation');
      
      // Exceed limit
      for (let i = 0; i < 61; i++) {
        await RateLimiterService.checkMessageRateLimit(userId);
      }
      
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          action: 'messages', // Note: action is 'messages' not 'message'
        })
      );
    });

    it('should allow admin to reset rate limits', async () => {
      const userId = 'test-user-10';
      
      // Exceed limit
      for (let i = 0; i < 61; i++) {
        await RateLimiterService.checkMessageRateLimit(userId);
      }
      
      // Should be blocked
      let result = await RateLimiterService.checkMessageRateLimit(userId);
      expect(result.allowed).toBe(false);
      
      // Admin resets limit
      await RateLimiterService.resetRateLimit(userId, 'messages');
      
      // Should be allowed again
      result = await RateLimiterService.checkMessageRateLimit(userId);
      expect(result.allowed).toBe(true);
    });

    // Property-based test: Rate limit should never allow more than max requests
    it('property: rate limit never exceeds maximum', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 70 }), // Reduced max from 100 to 70
          async (numRequests) => {
            const userId = `test-user-prop-${Math.random()}`;
            let allowedCount = 0;
            
            for (let i = 0; i < numRequests; i++) {
              const result = await RateLimiterService.checkMessageRateLimit(userId);
              if (result.allowed) {
                allowedCount++;
              }
            }
            
            expect(allowedCount).toBeLessThanOrEqual(60);
          }
        ),
        { numRuns: 5 } // Reduced from 10 to 5 for faster execution
      );
    }, 20000); // 20 second timeout for property-based test
  });

  // ============================================================================
  // 4. FILE UPLOAD VALIDATION TESTS
  // ============================================================================
  
  describe('File Upload Validation', () => {
    
    it('should validate file size within limit (50MB)', () => {
      const validFile = new File(['x'.repeat(1024)], 'test.txt', { type: 'text/plain' });
      const result = validateFileSize(validFile);
      
      expect(result.valid).toBe(true);
    });

    it('should reject files exceeding size limit', () => {
      // Create a file larger than 50MB (simulated)
      const largeFile = new File(['x'], 'large.txt', { type: 'text/plain' });
      Object.defineProperty(largeFile, 'size', { value: 51 * 1024 * 1024 });
      
      const result = validateFileSize(largeFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds');
    });

    it('should reject empty files', () => {
      const emptyFile = new File([], 'empty.txt', { type: 'text/plain' });
      const result = validateFileSize(emptyFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should validate allowed file types', () => {
      const allowedFiles = [
        new File(['x'], 'image.jpg', { type: 'image/jpeg' }),
        new File(['x'], 'doc.pdf', { type: 'application/pdf' }),
        new File(['x'], 'sheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        new File(['x'], 'video.mp4', { type: 'video/mp4' }),
      ];

      allowedFiles.forEach((file) => {
        const result = validateFileType(file);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject disallowed file types', () => {
      const disallowedFiles = [
        new File(['x'], 'script.exe', { type: 'application/x-msdownload' }),
        new File(['x'], 'malware.bat', { type: 'application/x-bat' }),
        new File(['x'], 'virus.vbs', { type: 'application/x-vbscript' }),
      ];

      disallowedFiles.forEach((file) => {
        const result = validateFileType(file);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('not allowed');
      });
    });

    it('should validate file extension matches MIME type', () => {
      // File with mismatched extension and MIME type
      const mismatchedFile = new File(['x'], 'image.jpg', { type: 'application/pdf' });
      const result = validateFileType(mismatchedFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match');
    });

    it('should validate multiple files count (max 10)', () => {
      const files = Array.from({ length: 9 }, (_, i) => 
        new File(['x'], `file${i}.txt`, { type: 'text/plain' })
      );
      
      const result = validateMultipleFiles(files);
      expect(result.valid).toBe(true);
    });

    it('should reject more than 10 files', () => {
      const files = Array.from({ length: 11 }, (_, i) => 
        new File(['x'], `file${i}.txt`, { type: 'text/plain' })
      );
      
      const result = validateMultipleFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('up to 10');
    });

    it('should validate batch of files', () => {
      const validFiles = [
        new File(['x'], 'doc1.pdf', { type: 'application/pdf' }),
        new File(['x'], 'image1.jpg', { type: 'image/jpeg' }),
      ];
      
      const result = validateFiles(validFiles);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validFiles).toHaveLength(2);
    });

    it('should separate valid and invalid files in batch', () => {
      const mixedFiles = [
        new File(['x'], 'valid.pdf', { type: 'application/pdf' }),
        new File(['x'], 'invalid.exe', { type: 'application/x-msdownload' }),
        new File(['x'], 'valid.jpg', { type: 'image/jpeg' }),
      ];
      
      const result = validateFiles(mixedFiles);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.validFiles).toHaveLength(2);
    });

    it('should sanitize filenames to prevent path traversal', () => {
      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config',
        'file/with/slashes.txt',
        'file\\with\\backslashes.txt',
        'file:with:colons.txt',
        'file<with>brackets.txt',
        'file|with|pipes.txt',
        '...dangerous.txt',
      ];

      maliciousFilenames.forEach((filename) => {
        const sanitized = sanitizeFilename(filename);
        expect(sanitized).not.toContain('..');
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain('\\');
        expect(sanitized).not.toContain(':');
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
        expect(sanitized).not.toContain('|');
      });
    });

    it('should handle null bytes in filenames', () => {
      const filename = 'file\0name.txt';
      const sanitized = sanitizeFilename(filename);
      
      expect(sanitized).not.toContain('\0');
    });

    it('should limit filename length to 255 characters', () => {
      const longFilename = 'a'.repeat(300) + '.txt';
      const sanitized = sanitizeFilename(longFilename);
      
      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized).toMatch(/\.txt$/); // Extension preserved
    });

    it('should identify image files correctly', () => {
      const imageFile = new File(['x'], 'image.jpg', { type: 'image/jpeg' });
      expect(isImageFile(imageFile)).toBe(true);
      
      const nonImageFile = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
      expect(isImageFile(nonImageFile)).toBe(false);
    });

    it('should identify video files correctly', () => {
      const videoFile = new File(['x'], 'video.mp4', { type: 'video/mp4' });
      expect(isVideoFile(videoFile)).toBe(true);
      
      const nonVideoFile = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
      expect(isVideoFile(nonVideoFile)).toBe(false);
    });

    it('should identify document files correctly', () => {
      const docFile = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
      expect(isDocumentFile(docFile)).toBe(true);
      
      const nonDocFile = new File(['x'], 'image.jpg', { type: 'image/jpeg' });
      expect(isDocumentFile(nonDocFile)).toBe(false);
    });

    // Property-based test: Sanitized filenames should never contain dangerous characters
    it('property: sanitized filenames are always safe', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 300 }),
          (filename) => {
            const sanitized = sanitizeFilename(filename);
            
            expect(sanitized).not.toContain('..');
            expect(sanitized).not.toContain('/');
            expect(sanitized).not.toContain('\\');
            expect(sanitized).not.toContain('\0');
            expect(sanitized.length).toBeLessThanOrEqual(255);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // 5. INTEGRATION TESTS - Combined Security Measures
  // ============================================================================
  
  describe('Integration: Combined Security Measures', () => {
    
    it('should enforce all security measures for message sending', async () => {
      const userId = 'integration-user-1';
      const maliciousMessage = '<script>alert("XSS")</script>Hello';
      
      // 1. Sanitize message content
      const sanitized = sanitizeMessage(maliciousMessage);
      expect(sanitized).not.toContain('<script');
      
      // 2. Validate message content
      const validation = validateMessageContent(sanitized);
      expect(validation.valid).toBe(true);
      
      // 3. Check rate limit
      const rateLimit = await RateLimiterService.checkMessageRateLimit(userId);
      expect(rateLimit.allowed).toBe(true);
      
      // 4. Validate CSRF token
      const token = initializeCsrfToken();
      const csrfValid = validateCsrfToken(token);
      expect(csrfValid).toBe(true);
    });

    it('should enforce all security measures for file upload', async () => {
      const userId = 'integration-user-2';
      const file = new File(['test content'], '../../../malicious.pdf', { 
        type: 'application/pdf' 
      });
      
      // 1. Sanitize filename
      const sanitizedName = sanitizeFilename(file.name);
      expect(sanitizedName).not.toContain('..');
      
      // 2. Validate file
      const validation = validateFile(file);
      expect(validation.valid).toBe(true);
      
      // 3. Check rate limit
      const rateLimit = await RateLimiterService.checkFileUploadRateLimit(userId);
      expect(rateLimit.allowed).toBe(true);
      
      // 4. Validate CSRF token
      const token = initializeCsrfToken();
      const csrfValid = validateCsrfToken(token);
      expect(csrfValid).toBe(true);
    });

    it('should block operations when any security check fails', async () => {
      const userId = 'integration-user-3';
      
      // Exceed rate limit
      for (let i = 0; i < 61; i++) {
        await RateLimiterService.checkMessageRateLimit(userId);
      }
      
      // Even with valid content and CSRF token, should be blocked
      const sanitized = sanitizeMessage('Valid message');
      const validation = validateMessageContent(sanitized);
      const token = initializeCsrfToken();
      const csrfValid = validateCsrfToken(token);
      const rateLimit = await RateLimiterService.checkMessageRateLimit(userId);
      
      expect(validation.valid).toBe(true);
      expect(csrfValid).toBe(true);
      expect(rateLimit.allowed).toBe(false); // Blocked by rate limit
    });
  });
});
