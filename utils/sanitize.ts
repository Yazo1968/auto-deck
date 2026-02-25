import DOMPurify from 'dompurify';

/**
 * Sanitize HTML output (e.g. from marked.parse()) to prevent XSS.
 * Allows standard formatting tags used in markdown rendering.
 */
export const sanitizeHtml = (html: string): string =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
