import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import ContactUs from './ContactUs';

const renderWithRouter = (ui) => render(<HelmetProvider><BrowserRouter>{ui}</BrowserRouter></HelmetProvider>);

describe('ContactUs', () => {
  it('renders heading', () => {
    renderWithRouter(<ContactUs />);
    expect(screen.getByRole('heading', { name: /contact us/i })).toBeInTheDocument();
  });

  it('renders contact form inputs', () => {
    renderWithRouter(<ContactUs />);
    expect(screen.getByRole('textbox', { name: /your name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email address/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('renders HAR brokerage information link', () => {
    renderWithRouter(<ContactUs />);
    const link = screen.getByRole('link', { name: /har brokerage information/i });
    expect(link).toHaveAttribute(
      'href',
      'https://members.har.com/mhf/terms/dispBrokerInfo.cfm?sitetype=aws&cid=735771'
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('notes the DBA disclosure', () => {
    renderWithRouter(<ContactUs />);
    expect(
      screen.getByText(/carwoods is a dba of alzoubi motors llc/i)
    ).toBeInTheDocument();
  });
});
