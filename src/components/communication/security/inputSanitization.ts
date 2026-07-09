/**
 * Input Sanitization and XSS Prevention
 * Task 11.1: Implement input sanitization and XSS prevention
 * Requirements: 20.1, 34.12
 * 
 * This module provides comprehensive input sanitization to prevent XSS attacks
 * while allowing safe markdown-style formatting in messages.
 */

import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

/**
 * Configuration for DOMPurify - Message Content
 * Allows safe markdown-like HTML while preventing XSS
 * Supports: bold, italic, strikethrough, code, lists, blockquotes, links
 */
const MESSAGE_PURIFY_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'del', 'code', 'pre',
    'ul', 'ol', 'li', 'blockquote', 'a', 'span', 'img', 'video', 'source',
  ],
  ALLOWED_ATTR: {
    'a': ['href', 'title', 'target', 'rel', 'class'],
    'span': ['class'],
    'code': ['class'],
    'pre': ['class'],
    'img': ['src', 'alt', 'class', 'loading', 'referrerpolicy'],
    'video': ['src', 'controls', 'class', 'preload', 'playsinline'],
    'source': ['src', 'type'],
  },
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SAFE_FOR_TEMPLATES: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  FORCE_BODY: false,
};

function escapeHljsFallback(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightFencedCode(code: string, langRaw: string): string {
  const raw = code.trim();
  const langKey = langRaw.toLowerCase().replace(/[^a-z0-9+-]/g, '');
  try {
    if (langKey && hljs.getLanguage(langKey)) {
      return hljs.highlight(raw, { language: langKey }).value;
    }
    const alias =
      langKey === 'py'
        ? 'python'
        : langKey === 'js'
          ? 'javascript'
          : langKey === 'ts'
            ? 'typescript'
            : langKey;
    if (alias !== langKey && hljs.getLanguage(alias)) {
      return hljs.highlight(raw, { language: alias }).value;
    }
    return hljs.highlightAuto(raw).value;
  } catch {
    return escapeHljsFallback(raw);
  }
}

/** Autolink bare URLs after markdown links exist; skip text inside HTML tags. */
function linkifyOutsideTags(html: string): string {
  return html.split(/(<[^>]+>)/g).map((chunk) => {
    if (chunk.startsWith('<')) return chunk;
    return linkifyBareUrlsInPlainText(chunk);
  }).join('');
}

function stripTrailingUrlPunct(url: string): { url: string; rest: string } {
  let u = url;
  let rest = '';
  while (u.length > 0 && /[),.;!?]+$/.test(u)) {
    const ch = u[u.length - 1];
    if (ch === ')' && u.includes('(')) break;
    rest = ch + rest;
    u = u.slice(0, -1);
  }
  return { url: u, rest };
}

function linkifyBareUrlsInPlainText(text: string): string {
  if (!text.includes('http')) return text;
  return text.replace(/\bhttps?:\/\/[^\s<>`]+/gi, (full) => {
    const { url, rest } = stripTrailingUrlPunct(full);
    if (!/^https?:\/\//i.test(url)) return full;
    const pathLow = url.split(/[?#]/)[0].toLowerCase();

    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(pathLow)) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="" class="max-h-64 max-w-full rounded-md my-1 block" loading="lazy" referrerpolicy="no-referrer" /></a>${rest}`;
    }
    if (/\.(mp4|webm|ogg)$/i.test(pathLow)) {
      return `<video src="${url}" controls class="max-h-64 max-w-full rounded-md my-2 block" preload="metadata" playsinline>${url}</video>${rest}`;
    }

    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (yt) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary underline font-medium">YouTube video</a>${rest}`;
    }
    const hostPath = url.replace(/^https?:\/\//i, '');
    if (/^(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/\d+/i.test(hostPath)) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary underline font-medium">Post on X</a>${rest}`;
    }
    if (/github\.com\//i.test(hostPath)) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary underline font-medium">GitHub</a>${rest}`;
    }

    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${rest}`;
  });
}

function processInlineMarkdown(text: string): string {
  const codeSpans: string[] = [];
  let s = text.replace(/`([^`]+)`/g, (_, code) => {
    const tok = `%%INLINE_CODE_${codeSpans.length}%%`;
    codeSpans.push(code);
    return tok;
  });

  s = s.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
  s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/_(.+?)_/g, '<em>$1</em>');

  s = linkifyOutsideTags(s);

  s = s.replace(/%%INLINE_CODE_(\d+)%%/g, (_, i) => `<code>${codeSpans[Number(i)]}</code>`);
  return s;
}

function processBlockParagraph(block: string, codePlaceholders: string[]): string {
  const trimmed = block.trim();
  if (!trimmed) return '';

  const codeMatch = trimmed.match(/^%%CODE_(\d+)%%$/);
  if (codeMatch) {
    return codePlaceholders[Number(codeMatch[1])] ?? '';
  }

  const lines = block.split('\n');

  if (lines.every((l) => !l.trim() || /^>\s?/.test(l))) {
    const inner = lines
      .filter((l) => l.trim())
      .map((l) => l.replace(/^>\s?/, ''))
      .join('\n');
    return `<blockquote>${processInlineMarkdown(inner).replace(/\n/g, '<br>')}</blockquote>`;
  }

  if (lines.every((l) => !l.trim() || /^[-*]\s+\S/.test(l))) {
    const items = lines
      .filter((l) => l.trim())
      .map((l) => `<li>${processInlineMarkdown(l.replace(/^[-*]\s+/, ''))}</li>`);
    return `<ul>${items.join('')}</ul>`;
  }

  if (lines.every((l) => !l.trim() || /^\d+\.\s+\S/.test(l))) {
    const items = lines
      .filter((l) => l.trim())
      .map((l) => `<li>${processInlineMarkdown(l.replace(/^\d+\.\s+/, ''))}</li>`);
    return `<ol>${items.join('')}</ol>`;
  }

  return lines
    .map((l) => (l.trim() ? processInlineMarkdown(l) : ''))
    .join('<br>');
}

/**
 * Sanitize message content to prevent XSS attacks
 * Supports markdown-style formatting while removing malicious code
 * 
 * @param content - Raw message content from user
 * @returns Sanitized HTML-safe content
 * 
 * Requirements: 20.1, 34.12
 */
export function sanitizeMessage(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // First pass: sanitize with DOMPurify
  let sanitized = DOMPurify.sanitize(content, MESSAGE_PURIFY_CONFIG);
  
  // Additional security: remove javascript: protocols (defense in depth)
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove on* event handlers that might have slipped through
  sanitized = sanitized.replace(/\son\w+\s*=/gi, '');
  
  return sanitized.trim();
}

/**
 * Sanitize markdown content and convert to safe HTML
 * Processes markdown syntax before sanitization
 * 
 * @param markdown - Raw markdown content
 * @returns Sanitized HTML
 */
export function sanitizeMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  const codePlaceholders: string[] = [];
  let md = markdown;

  md = md.replace(/```([a-zA-Z0-9+-]*)\n?([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const safeLang = String(lang || '').replace(/[^a-zA-Z0-9+-]/g, '');
    const innerHtml = highlightFencedCode(String(code), safeLang);
    const cls = safeLang ? `hljs language-${safeLang.toLowerCase()}` : 'hljs';
    const html = `<pre><code class="${cls}">${innerHtml}</code></pre>`;
    const token = `%%CODE_${codePlaceholders.length}%%`;
    codePlaceholders.push(html);
    return `\n\n${token}\n\n`;
  });

  const blocks = md.split(/\n{2,}/);
  const html = blocks.map((b) => processBlockParagraph(b, codePlaceholders)).join('');

  return sanitizeMessage(html);
}

/**
 * Sanitize user input for display in UI
 * More restrictive than message sanitization
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Strip all HTML tags for user input fields
  const stripped = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  
  return stripped.trim();
}

/**
 * Sanitize file names to prevent path traversal attacks
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    return 'unnamed_file';
  }

  // Remove path separators and dangerous characters
  const sanitized = fileName
    .replace(/[\/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[<>:"|?*]/g, '_')
    .trim();

  // Ensure filename is not empty after sanitization
  return sanitized || 'unnamed_file';
}

/**
 * Validate and sanitize URLs
 */
export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);
    
    // Only allow http, https, and mailto protocols
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Escape HTML entities for safe display
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Validate message content length and format
 */
export function validateMessageContent(content: string): {
  valid: boolean;
  error?: string;
} {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Message content is required' };
  }

  const trimmed = content.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (trimmed.length > 4000) {
    return { valid: false, error: 'Message exceeds 4000 character limit' };
  }

  return { valid: true };
}
