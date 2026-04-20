import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import SelfManagedLandlords from './SelfManagedLandlords';

const renderWithRouter = (ui) =>
    render(
        <HelmetProvider>
            <BrowserRouter>{ui}</BrowserRouter>
        </HelmetProvider>
    );

describe('SelfManagedLandlords', () => {
    it('renders the page h1 heading', () => {
        renderWithRouter(<SelfManagedLandlords />);
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /manage your rentals with our tools/i,
            })
        ).toBeInTheDocument();
    });

    it('renders the persona tagline', () => {
        renderWithRouter(<SelfManagedLandlords />);
        expect(
            screen.getByText(/for landlords who want control with the best tools at their fingertips/i)
        ).toBeInTheDocument();
    });

    it('renders the six portal feature cards', () => {
        renderWithRouter(<SelfManagedLandlords />);
        expect(
            screen.getByRole('heading', { level: 2, name: /everything you need in one portal/i })
        ).toBeInTheDocument();
        const featureHeadings = screen.getAllByRole('heading', { level: 3 });
        expect(featureHeadings).toHaveLength(6);
        expect(
            screen.getByRole('heading', { level: 3, name: /tenant screening tools/i })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { level: 3, name: /maintenance request platform/i })
        ).toBeInTheDocument();
    });

    it('links the See Pricing CTA to /pricing', () => {
        renderWithRouter(<SelfManagedLandlords />);
        const cta = screen.getByRole('link', { name: /see pricing and start self-managing/i });
        expect(cta).toHaveAttribute('href', '/pricing');
    });

    it('links the compare CTA to /property-management#compare', () => {
        renderWithRouter(<SelfManagedLandlords />);
        const cta = screen.getByRole('link', { name: /compare self-managed tools with full-service management/i });
        expect(cta).toHaveAttribute('href', '/property-management#compare');
    });

    it('preserves the /dark preview prefix on internal CTA links', () => {
        render(
            <HelmetProvider>
                <MemoryRouter initialEntries={['/dark/self-managed-landlords']}>
                    <SelfManagedLandlords />
                </MemoryRouter>
            </HelmetProvider>
        );
        const pricingCta = screen.getByRole('link', { name: /see pricing and start self-managing/i });
        expect(pricingCta).toHaveAttribute('href', '/dark/pricing');
        const compareCta = screen.getByRole('link', { name: /compare self-managed tools with full-service management/i });
        expect(compareCta).toHaveAttribute('href', '/dark/property-management#compare');
    });
});
