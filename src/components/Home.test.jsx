import React from 'react';
import { render, screen } from '@testing-library/react';
import { WithAppTheme } from '../testUtils';
import Home from './Home';

const renderWithRouter = (ui) => render(<WithAppTheme>{ui}</WithAppTheme>);

describe('Home', () => {
    it('renders heading', () => {
        renderWithRouter(<Home />);
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: /property management in houston\. self-management anywhere\./i,
            })
        ).toBeInTheDocument();
    });

    it('renders audience sections', () => {
        renderWithRouter(<Home />);
        expect(screen.getByRole('heading', { name: /^renters$/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /^full-service property management$/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /^self-managed landlords$/i })).toBeInTheDocument();
    });

    it('renders CTA link to Apply page', () => {
        renderWithRouter(<Home />);
        const applyLink = screen.getByRole('link', { name: /renters/i });
        expect(applyLink).toHaveAttribute('href', '/apply');
    });

    it('renders CTA link to full-service property management page', () => {
        renderWithRouter(<Home />);
        const pmLink = screen.getByRole('link', { name: /full-service property management/i });
        expect(pmLink).toHaveAttribute('href', '/property-management');
    });

    it('renders CTA link to self-managed landlords page', () => {
        renderWithRouter(<Home />);
        const selfLink = screen.getByRole('link', { name: /self-managed landlords/i });
        expect(selfLink).toHaveAttribute('href', '/self-managed-landlords');
    });
});
