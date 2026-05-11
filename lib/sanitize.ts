import DOMPurify from "dompurify";

export function escapeHtmlText(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

const DOC_SANITIZE: import("dompurify").Config = {
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "link", "meta"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
};

export function sanitizeDocHtml(html: string): string {
  return DOMPurify.sanitize(html, DOC_SANITIZE);
}

export function sanitizeHighlight(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ["mark"], ALLOWED_ATTR: [] });
}
