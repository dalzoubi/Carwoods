import { describe, expect, it } from 'vitest';
import {
  PORTAL_MESSAGE_BODY_MAX_CHARS,
  editorHtmlToMarkdown,
  isAllowedMessageLinkHref,
  markdownToTipTapHtml,
  renderPortalMessageMarkdownToHtml,
} from './portalMessageEditorBridge';

describe('portalMessageEditorBridge', () => {
  it('exports 200 char cap', () => {
    expect(PORTAL_MESSAGE_BODY_MAX_CHARS).toBe(200);
  });

  it('roundtrips bold markdown', () => {
    const md = 'Say **hello** there';
    const tipTapHtml = markdownToTipTapHtml(md);
    expect(tipTapHtml).toContain('<strong>');
    const back = editorHtmlToMarkdown(tipTapHtml);
    expect(back).toContain('**hello**');
  });

  it('roundtrips bullet list through html', () => {
    const md = '- a\n- b';
    const tipTapHtml = markdownToTipTapHtml(md);
    expect(tipTapHtml).toContain('<ul>');
    const back = editorHtmlToMarkdown(tipTapHtml);
    expect(back).toContain('a');
    expect(back).toContain('b');
  });

  it('returns empty markdown for empty editor html', () => {
    expect(editorHtmlToMarkdown('<p></p>')).toBe('');
  });

  it('allows only safe link schemes', () => {
    expect(isAllowedMessageLinkHref('https://a')).toBe(true);
    expect(isAllowedMessageLinkHref('mailto:x@y.com')).toBe(true);
    // eslint-disable-next-line no-script-url -- intentional negative test for disallowed href
    expect(isAllowedMessageLinkHref('javascript:alert(1)')).toBe(false);
  });

  it('renders two list items for standard bullet markdown', () => {
    const view = renderPortalMessageMarkdownToHtml('- one\n- two');
    expect((view.match(/<li>/g) || []).length).toBe(2);
  });

  it('renderPortalMessageMarkdownToHtml adds rel on links', () => {
    const view = renderPortalMessageMarkdownToHtml('[x](https://x.com)');
    expect(view).toContain('href="https://x.com"');
    expect(view).toContain('noopener');
    expect(view).toContain('_blank');
  });

  describe('renderPortalMessageMarkdownToHtml — XSS sanitization pins', () => {
    it('escapes raw <script> tags in source markdown', () => {
      // eslint-disable-next-line no-script-url -- intentional negative test
      const view = renderPortalMessageMarkdownToHtml('<script>alert(1)</script>');
      expect(view).not.toMatch(/<script\b/i);
      expect(view).toContain('&lt;script&gt;');
    });

    it('escapes raw <img onerror> tags in source markdown', () => {
      const view = renderPortalMessageMarkdownToHtml('<img src=x onerror=alert(1)>');
      expect(view).not.toMatch(/<img\b/i);
      expect(view).toContain('&lt;img');
    });

    it('neutralizes javascript: links (no anchor rendered)', () => {
      // eslint-disable-next-line no-script-url -- intentional negative test
      const view = renderPortalMessageMarkdownToHtml('[evil](javascript:alert(1))');
      expect(view).not.toMatch(/<a\b/i);
      expect(view).not.toMatch(/href\s*=\s*"?javascript:/i);
    });

    it('renders safe external https links with rel="noopener noreferrer" and target="_blank"', () => {
      const view = renderPortalMessageMarkdownToHtml('[ok](https://example.com)');
      expect(view).toMatch(/<a\b/i);
      expect(view).toContain('href="https://example.com"');
      expect(view).toContain('rel="noopener noreferrer"');
      expect(view).toContain('target="_blank"');
    });

    it('still renders standard inline formatting (sanity)', () => {
      const view = renderPortalMessageMarkdownToHtml('**bold**');
      expect(view).toContain('<strong>bold</strong>');
    });
  });
});
