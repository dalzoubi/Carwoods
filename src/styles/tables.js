import React, { useState } from 'react';
import styled from 'styled-components';
import theme from '../theme';

export const FilteredSection = styled.section`
    &[data-filtered='true'] {
        display: none;
        height: 0;
        margin: 0;
        padding: 0;
    }

    @media print {
        break-inside: auto;

        &[data-filtered='true'] {
            display: none !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            break-before: avoid !important;
            break-after: avoid !important;
            break-inside: avoid !important;
        }
    }
`;

export const PersonalizeCard = styled.div`
    background: var(--personalize-card-bg);
    border-inline-start: 4px solid var(--palette-primary-main);
    border-start-start-radius: 0;
    border-start-end-radius: var(--shape-border-radius);
    border-end-end-radius: var(--shape-border-radius);
    border-end-start-radius: 0;
    padding: ${theme.spacing(1.25)} ${theme.spacing(2)};
    margin: ${theme.spacing(2)} 0 ${theme.spacing(3)};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing(1.5)};

    @media (max-width: 480px) {
        flex-direction: column;
        align-items: flex-start;
        gap: ${theme.spacing(1)};
    }

    @media print {
        display: none !important;
    }
`;

export const PersonalizeCardText = styled.div`
    flex: 1;
    min-width: 0;
`;

export const PersonalizeCardTitle = styled.p`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.875)};
    font-size: var(--typography-body1-font-size);
    font-weight: 600;
    color: var(--palette-primary-main);
    margin: 0 0 ${theme.spacing(0.25)};

    & > .MuiSvgIcon-root {
        flex-shrink: 0;
        font-size: 1.35rem;
    }

    @media (max-width: 480px) {
        font-size: 0.9rem;

        & > .MuiSvgIcon-root {
            font-size: 1.2rem;
        }
    }
`;

export const PersonalizeCardDesc = styled.p`
    font-size: 0.875rem;
    color: var(--palette-text-secondary);
    margin: 0;

    @media (max-width: 480px) {
        font-size: 0.8rem;
    }
`;

export const FilterBanner = styled.div`
    background: var(--filter-banner-bg);
    border-inline-start: 4px solid var(--filter-banner-border);
    border-start-start-radius: 0;
    border-start-end-radius: var(--shape-border-radius);
    border-end-end-radius: var(--shape-border-radius);
    border-end-start-radius: 0;
    padding: ${theme.spacing(1.5)} ${theme.spacing(2.5)};
    margin: ${theme.spacing(2)} 0 ${theme.spacing(3)};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing(2)};
    flex-wrap: wrap;

    @media (max-width: 480px) {
        flex-direction: column;
        align-items: flex-start;
        gap: ${theme.spacing(1)};
    }

    @media print {
        display: none !important;
    }
`;

export const FilterBannerText = styled.div`
    flex: 1;
    min-width: 0;
`;

export const FilterBannerLabel = styled.p`
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--filter-banner-label);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 ${theme.spacing(0.5)};
`;

export const FilterBannerChips = styled.p`
    font-size: var(--typography-body1-font-size);
    color: var(--filter-banner-text);
    margin: 0;
    font-weight: 500;
`;

export const FilterBannerActions = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1.5)};
    flex-shrink: 0;
    flex-wrap: wrap;

    @media (max-width: 480px) {
        flex-shrink: 1;
        width: 100%;
    }
`;

const SmoothDetailsBody = styled.div`
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.25s ease;

    &[data-open='true'] {
        grid-template-rows: 1fr;
    }

    @media print {
        grid-template-rows: 1fr;
    }
`;

const SmoothDetailsInner = styled.div`
    overflow: hidden;
`;

const SmoothDetailsSummaryButton = styled.button`
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    color: var(--palette-primary-main);
    font-size: var(--typography-body1-font-size);
    line-height: 1.5;
    padding: ${theme.spacing(0.75)} 0;
    display: flex;
    align-items: center;
    gap: 0.5em;

    &::before {
        content: '▶';
        font-size: 0.7em;
        flex-shrink: 0;
        transition: transform 0.25s ease;
    }

    &[aria-expanded='true']::before {
        transform: rotate(90deg);
    }

    &:hover {
        color: var(--palette-primary-dark);
    }

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 2px;
        border-radius: 2px;
    }

    @media print {
        display: none;
    }
`;

export const SmoothDetails = ({ summary, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return React.createElement(
        'div',
        null,
        React.createElement(
            SmoothDetailsSummaryButton,
            { 'aria-expanded': open, onClick: () => setOpen((o) => !o) },
            summary
        ),
        React.createElement(
            SmoothDetailsBody,
            { 'data-open': String(open) },
            React.createElement(SmoothDetailsInner, null, children)
        )
    );
};
