import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import PropertyManagement from './PropertyManagement';

const renderWithRouter = (ui) =>
    render(
        <HelmetProvider>
            <BrowserRouter>{ui}</BrowserRouter>
        </HelmetProvider>
    );

describe('PropertyManagement', () => {
    it('renders the page h1 heading', () => {
        renderWithRouter(<PropertyManagement />);
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /let us manage it all for you/i,
            })
        ).toBeInTheDocument();
    });

    it('renders the full-service persona tagline', () => {
        renderWithRouter(<PropertyManagement />);
        expect(
            screen.getByText(/for property owners who want a stress-free, hands-off experience/i)
        ).toBeInTheDocument();
    });

    it('renders the Self-Managed vs Full-Service comparison table', () => {
        renderWithRouter(<PropertyManagement />);
        expect(
            screen.getByRole('heading', { level: 2, name: /self-managed vs\. full-service/i })
        ).toBeInTheDocument();
        const columnHeaders = screen.getAllByRole('columnheader');
        const headerText = columnHeaders.map((c) => c.textContent);
        expect(headerText.some((t) => /self-managed/i.test(t))).toBe(true);
        expect(headerText.some((t) => /full-service/i.test(t))).toBe(true);
        const cells = screen.getAllByRole('cell');
        expect(cells.some((c) => /tenant screening/i.test(c.textContent))).toBe(true);
        expect(cells.some((c) => /marketing & listing/i.test(c.textContent))).toBe(true);
    });

    it('links the Self-Managed column header to /self-managed-landlords', () => {
        renderWithRouter(<PropertyManagement />);
        const selfLink = screen.getByRole('link', { name: /see self-managed tools/i });
        expect(selfLink).toHaveAttribute('href', '/self-managed-landlords');
    });

    it('renders the hero subtitle describing services', () => {
        renderWithRouter(<PropertyManagement />);
        expect(
            screen.getByText(/licensed houston realtor and property manager/i)
        ).toBeInTheDocument();
    });

    it('renders the services section with four service cards', () => {
        renderWithRouter(<PropertyManagement />);
        expect(
            screen.getByRole('heading', { level: 2, name: /what we handle for you/i })
        ).toBeInTheDocument();
        const serviceHeadings = screen.getAllByRole('heading', { level: 3 });
        expect(serviceHeadings).toHaveLength(4);
        expect(
            screen.getByRole('heading', { level: 3, name: /leasing and marketing/i })
        ).toBeInTheDocument();
    });

    it('renders the Why Carwoods section', () => {
        renderWithRouter(<PropertyManagement />);
        expect(
            screen.getByRole('heading', { level: 2, name: /why carwoods/i })
        ).toBeInTheDocument();
    });

    it('renders the bottom CTA section', () => {
        renderWithRouter(<PropertyManagement />);
        expect(
            screen.getByRole('heading', { level: 2, name: /ready to get started/i })
        ).toBeInTheDocument();
    });

    it('renders Contact Us CTA links pointing to /contact-us', () => {
        renderWithRouter(<PropertyManagement />);
        const ctaLinks = screen.getAllByRole('link', {
            name: /contact carwoods about property management services/i,
        });
        expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
        ctaLinks.forEach((link) => {
            expect(link).toHaveAttribute('href', '/contact-us');
        });
    });

    it('preserves the /dark preview prefix on Contact Us links', () => {
        render(
            <HelmetProvider>
                <MemoryRouter initialEntries={['/dark/property-management']}>
                    <PropertyManagement />
                </MemoryRouter>
            </HelmetProvider>
        );
        const ctaLinks = screen.getAllByRole('link', {
            name: /contact carwoods about property management services/i,
        });
        expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
        ctaLinks.forEach((link) => {
            expect(link).toHaveAttribute('href', '/dark/contact-us');
        });
    });
});
