import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { PortalMessageBody } from './portalMessageBodyFormat';

function renderWithTheme(ui) {
  return render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);
}

describe('PortalMessageBody', () => {
  it('renders bold and italic from markdown', () => {
    renderWithTheme(<PortalMessageBody text="**bold** and *italic*" />);
    expect(screen.getByText('bold', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('italic', { selector: 'em' })).toBeInTheDocument();
  });

  it('renders safe external links with target and rel', () => {
    renderWithTheme(
      <PortalMessageBody text="see [example](https://example.com/path)" />
    );
    const link = screen.getByRole('link', { name: 'example' });
    expect(link).toHaveAttribute('href', 'https://example.com/path');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders bullet lists', () => {
    renderWithTheme(<PortalMessageBody text={'- one\n- two'} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('one');
    expect(items[1].textContent).toContain('two');
  });

  it('renders line breaks within a paragraph', () => {
    renderWithTheme(<PortalMessageBody text={'line1\nline2'} />);
    expect(screen.getByRole('paragraph')).toHaveTextContent(/line1/);
    expect(screen.getByRole('paragraph')).toHaveTextContent(/line2/);
  });
});
