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
    const html = markdownToTipTapHtml(md);
    expect(html).toContain('<strong>');
    const back = editorHtmlToMarkdown(html);
    expect(back).toContain('**hello**');
  });

  it('roundtrips bullet list through html', () => {
    const md = '- a\n- b';
    const html = markdownToTipTapHtml(md);
    expect(html).toContain('<ul>');
    const back = editorHtmlToMarkdown(html);
    expect(back).toContain('a');
    expect(back).toContain('b');
  });

  it('returns empty markdown for empty editor html', () => {
    expect(editorHtmlToMarkdown('<p></p>')).toBe('');
  });

  it('allows only safe link schemes', () => {
    expect(isAllowedMessageLinkHref('https://a')).toBe(true);
    expect(isAllowedMessageLinkHref('mailto:x@y.com')).toBe(true);
    expect(isAllowedMessageLinkHref('javascript:alert(1)')).toBe(false);
  });

  it('renders two list items for standard bullet markdown', () => {
    const html = renderPortalMessageMarkdownToHtml('- one\n- two');
    expect((html.match(/<li>/g) || []).length).toBe(2);
  });

  it('renderPortalMessageMarkdownToHtml adds rel on links', () => {
    const html = renderPortalMessageMarkdownToHtml('[x](https://x.com)');
    expect(html).toContain('href="https://x.com"');
    expect(html).toContain('noopener');
    expect(html).toContain('_blank');
  });
});
