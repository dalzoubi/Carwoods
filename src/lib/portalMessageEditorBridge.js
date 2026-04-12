import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';

const mdParser = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: false,
});

/** @type {TurndownService | null} */
let turndownInstance = null;

function getTurndown() {
  if (!turndownInstance) {
    turndownInstance = new TurndownService({
      emDelimiter: '*',
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    turndownInstance.addRule('lineBreak', {
      filter: 'br',
      replacement: () => '\n',
    });
  }
  return turndownInstance;
}

/**
 * Strip TipTap-only noise before HTML → markdown.
 * @param {string} html
 */
function normalizeTipTapHtml(html) {
  return String(html ?? '')
    .replace(/<br[^>]*class="ProseMirror-trailingBreak"[^>]*\/?>/gi, '')
    .trim();
}

/**
 * Markdown (API / thread format) → HTML for TipTap `setContent`.
 * @param {string} markdown
 */
export function markdownToTipTapHtml(markdown) {
  const s = String(markdown ?? '').trim();
  if (!s) return '<p></p>';
  const rendered = mdParser.render(s).trim();
  return rendered || '<p></p>';
}

/**
 * TipTap `getHTML()` → markdown for API.
 * @param {string} html
 */
export function editorHtmlToMarkdown(html) {
  const normalized = normalizeTipTapHtml(html);
  if (!normalized) return '';
  const textOnly = normalized.replace(/<[^>]+>/g, '').replace(/\s/g, '');
  const hasLink = /<a\s/i.test(normalized);
  if (!textOnly && !hasLink) return '';

  const md = getTurndown().turndown(normalized).replace(/\u00a0/g, ' ').trim();
  return md;
}

/**
 * Allowed link targets (matches portal thread renderer).
 * @param {string} href
 */
export function isAllowedMessageLinkHref(href) {
  const u = String(href).trim().toLowerCase();
  if (!u) return false;
  return u.startsWith('https://') || u.startsWith('http://') || u.startsWith('mailto:');
}
