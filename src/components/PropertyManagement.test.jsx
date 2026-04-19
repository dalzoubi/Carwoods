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
                name: /professional property management in houston/i,
            })
        ).toBeInTheDocument();
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
