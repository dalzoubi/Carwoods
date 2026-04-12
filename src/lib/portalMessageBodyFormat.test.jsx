import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PortalMessageBody, parsePortalMessageBodyToNodes } from './portalMessageBodyFormat';

function renderWithTheme(ui) {
  return render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);
}

describe('parsePortalMessageBodyToNodes', () => {
  it('returns plain text as a single string node', () => {
    const keyRef = { n: 0 };
    const nodes = parsePortalMessageBodyToNodes('hello', keyRef, null);
    expect(nodes).toEqual(['hello']);
  });

  it('parses bold', () => {
    const keyRef = { n: 0 };
    const nodes = parsePortalMessageBodyToNodes('a **b** c', keyRef, null);
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toBe('a ');
    expect(nodes[2]).toBe(' c');
    const mid = nodes[1];
    expect(mid.type).toBe('strong');
  });

  it('does not treat javascript: as a link', () => {
    const keyRef = { n: 0 };
    const s = '[x](javascript:alert(1))';
    const nodes = parsePortalMessageBodyToNodes(s, keyRef, null);
    expect(nodes).toEqual([s]);
  });
});

describe('PortalMessageBody', () => {
  it('renders italic and code', () => {
    renderWithTheme(<PortalMessageBody text="*italic* and `code`" />);
    expect(screen.getByText('italic', { selector: 'em' })).toBeInTheDocument();
    expect(screen.getByText('code')).toBeInTheDocument();
  });

  it('renders safe external links', () => {
    renderWithTheme(
      <PortalMessageBody text="see [example](https://example.com/path)" />
    );
    const link = screen.getByRole('link', { name: 'example' });
    expect(link).toHaveAttribute('href', 'https://example.com/path');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('preserves newlines', () => {
    renderWithTheme(<PortalMessageBody text={'line1\nline2'} />);
    const root = screen.getByText((content, el) => el?.tagName === 'DIV' && content.includes('line1'));
    expect(root.textContent).toContain('line1');
    expect(root.textContent).toContain('line2');
  });
});
