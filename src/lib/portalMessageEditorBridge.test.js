import { describe, expect, it } from 'vitest';
import {
  editorHtmlToMarkdown,
  isAllowedMessageLinkHref,
  markdownToTipTapHtml,
} from './portalMessageEditorBridge';

describe('portalMessageEditorBridge', () => {
  it('roundtrips bold markdown', () => {
    const md = 'Say **hello** there';
    const html = markdownToTipTapHtml(md);
    expect(html).toContain('<strong>');
    const back = editorHtmlToMarkdown(html);
    expect(back).toContain('**hello**');
  });

  it('returns empty markdown for empty editor html', () => {
    expect(editorHtmlToMarkdown('<p></p>')).toBe('');
  });

  it('allows only safe link schemes', () => {
    expect(isAllowedMessageLinkHref('https://a')).toBe(true);
    expect(isAllowedMessageLinkHref('mailto:x@y.com')).toBe(true);
    expect(isAllowedMessageLinkHref('javascript:alert(1)')).toBe(false);
  });
});
