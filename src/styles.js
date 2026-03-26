import React, { useCallback, useState } from 'react';
import styled from 'styled-components';
import { NavLink as RouterNavLink } from 'react-router-dom';
import theme from './theme';

export const Container = styled.main`
    font-family: var(--typography-font-family);
    color: var(--palette-text-secondary);
    max-width: 1200px;
    margin: 0 auto;
    padding: ${theme.spacing(2.5)};
`;

export const Content = styled.section`
    margin-top: ${theme.spacing(2.5)};
    padding: ${theme.spacing(2.5)};
    background: var(--palette-background-paper);
    border-radius: var(--shape-border-radius);
    box-shadow: var(--shadow-card);
    color: var(--palette-text-secondary);
    animation: pageFadeIn 0.25s ease-out;

    @keyframes pageFadeIn {
        from {
            opacity: 0;
            transform: translateY(6px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

export const NavLink = styled(RouterNavLink)`
    color: var(--nav-chrome-text);
    text-decoration: none;
    font-weight: bold;
    padding: 0.5rem 1rem;
    transition: background 0.3s, color 0.3s;

    &.active {
        background: var(--nav-chrome-active-bg);
        color: var(--nav-chrome-active-text);
        border-radius: 4px;
    }

    &:hover {
        background: var(--nav-chrome-hover-bg);
        color: var(--nav-chrome-active-text);
        border-radius: 4px;
    }

    &:focus-visible {
        outline: 2px solid var(--nav-chrome-focus-ring);
        outline-offset: 2px;
    }
`;

export const Heading = styled.h1`
    color: var(--palette-primary-main);
    font-size: var(--typography-h1-font-size);
    font-weight: var(--typography-h1-font-weight);
    margin-bottom: ${theme.spacing(1.25)};
`;

export const SubHeading = styled.h2`
    color: var(--palette-primary-main);
    font-size: var(--typography-h2-font-size);
    font-weight: var(--typography-h2-font-weight);
    margin-top: ${theme.spacing(3)};
    margin-bottom: ${theme.spacing(1)};
    padding-bottom: ${theme.spacing(0.5)};
    border-bottom: 2px solid var(--palette-primary-light);
`;

export const SectionHeading = styled.h3`
    color: var(--palette-text-secondary);
    font-size: var(--typography-h3-font-size);
    font-weight: var(--typography-h3-font-weight);
    margin-top: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(0.75)};
`;

export const Paragraph = styled.p`
    line-height: var(--typography-body1-line-height);
    font-size: var(--typography-body1-font-size);
`;

export const InlineLink = styled.a`
    color: var(--palette-primary-main);
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.2s;

    &:hover {
        color: var(--palette-primary-dark);
    }

    &:visited {
        color: var(--palette-primary-dark);
    }

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 2px;
        border-radius: 2px;
    }
`;

export const Button = styled.a`
    display: inline-block;
    padding: 12px 24px;
    background-color: var(--cta-button-bg);
    color: var(--cta-button-text);
    border-radius: var(--shape-border-radius);
    font-weight: bold;
    font-size: var(--typography-body1-font-size);
    text-decoration: none;
    transition: background-color 0.2s, color 0.2s;

    &:hover {
        background-color: var(--cta-button-bg-hover);
        color: var(--cta-button-text);
    }

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 3px;
    }
`;

const TocNavBase = styled.nav`
    background: var(--toc-nav-bg);
    border-left: 4px solid var(--palette-primary-main);
    border-radius: 0 var(--shape-border-radius) var(--shape-border-radius) 0;
    padding: ${theme.spacing(1.5)} ${theme.spacing(2.5)};
    margin: ${theme.spacing(2)} 0 ${theme.spacing(3)};

    ol, ul {
        margin: ${theme.spacing(0.5)} 0;
        padding-left: ${theme.spacing(2.5)};
    }

    li {
        margin: ${theme.spacing(0.5)} 0;
        font-size: var(--typography-body1-font-size);
    }

    a {
        color: var(--palette-primary-main);
        text-decoration: none;
        text-underline-offset: 2px;

        &:hover {
            text-decoration: underline;
            color: var(--palette-primary-dark);
        }

        &:focus-visible {
            outline: 2px solid var(--palette-primary-light);
            outline-offset: 2px;
            border-radius: 2px;
        }
    }
`;

export const TocNav = ({ children, ...props }) => {
    const handleClick = useCallback((e) => {
        const anchor = e.target.closest('a[href^="#"]');
        if (!anchor) return;
        const id = anchor.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        history.pushState(null, '', `#${id}`);
    }, []);

    return React.createElement(TocNavBase, { onClick: handleClick, ...props }, children);
};

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


const BackToTopBase = styled.a`
    display: inline-block;
    margin-top: ${theme.spacing(1.5)};
    font-size: var(--typography-body2-font-size);
    color: var(--palette-primary-main);
    text-decoration: none;
    text-underline-offset: 2px;

    &:hover {
        text-decoration: underline;
        color: var(--palette-primary-dark);
    }

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 2px;
        border-radius: 2px;
    }
`;

export const BackToTop = ({ href, children, ...props }) => {
    const handleClick = useCallback((e) => {
        if (!href?.startsWith('#')) return;
        const id = href.slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        history.pushState(null, '', href);
    }, [href]);

    return React.createElement(BackToTopBase, { href, onClick: handleClick, ...props }, children);
};

export const nestedListStyle = { listStyleType: 'lower-alpha' };
export const nestedUlStyle = { listStyleType: 'disc' };

export const PageHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${theme.spacing(1.25)};

    h1 {
        margin-bottom: 0;
    }
`;

export const PrintButton = styled.button.attrs({ type: 'button' })`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    padding: 0;
    background: transparent;
    color: var(--palette-primary-main);
    border: 1.5px solid var(--palette-primary-main);
    border-radius: var(--shape-border-radius);
    cursor: pointer;
    transition: background 0.2s, color 0.2s;

    svg {
        width: 22px;
        height: 22px;
        fill: currentColor;
    }

    &:hover {
        background: var(--palette-primary-main);
        color: var(--print-button-hover-text);
    }

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 2px;
    }

    @media print {
        display: none !important;
    }
`;

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
    border-left: 4px solid var(--palette-primary-main);
    border-radius: 0 var(--shape-border-radius) var(--shape-border-radius) 0;
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
    font-size: var(--typography-body1-font-size);
    font-weight: 600;
    color: var(--palette-primary-main);
    margin: 0 0 ${theme.spacing(0.25)};

    @media (max-width: 480px) {
        font-size: 0.9rem;
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

export const PersonalizeCardButton = styled.button.attrs({ type: 'button' })`
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    padding: ${theme.spacing(0.625)} ${theme.spacing(1.5)};
    background: var(--personalize-button-bg);
    color: var(--personalize-button-fg);
    border: none;
    border-radius: var(--shape-border-radius);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    white-space: nowrap;

    &:hover {
        background: var(--personalize-button-bg-hover);
        color: var(--personalize-button-fg-hover);
    }

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 2px;
    }

    @media (max-width: 480px) {
        font-size: 0.8rem;
        padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
        gap: 0.3em;
    }
`;

export const FilterBanner = styled.div`
    background: var(--filter-banner-bg);
    border-left: 4px solid var(--filter-banner-border);
    border-radius: 0 var(--shape-border-radius) var(--shape-border-radius) 0;
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

export const FilterBannerEditButton = styled.button`
    display: inline-flex;
    align-items: center;
    padding: ${theme.spacing(0.5)} ${theme.spacing(1.5)};
    background: transparent;
    color: var(--filter-banner-edit-color);
    border: 1.5px solid var(--filter-banner-border);
    border-radius: var(--shape-border-radius);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;

    &:hover {
        background: var(--filter-banner-edit-hover-bg);
    }

    &:focus-visible {
        outline: 2px solid var(--filter-banner-edit-outline);
        outline-offset: 2px;
    }
`;

export const FilterBannerResetButton = styled.button`
    display: inline-flex;
    align-items: center;
    padding: ${theme.spacing(0.5)} ${theme.spacing(1.5)};
    background: var(--filter-banner-reset-bg);
    color: #fff;
    border: none;
    border-radius: var(--shape-border-radius);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;

    &:hover {
        background: var(--filter-banner-reset-hover);
    }

    &:focus-visible {
        outline: 2px solid var(--filter-banner-reset-outline);
        outline-offset: 2px;
    }
`;

export const PrintHeader = styled.div`
    display: none;

    @media print {
        display: flex !important;
        justify-content: center;
        align-items: center;
        margin-bottom: 14pt;
        padding-bottom: 10pt;
        border-bottom: 1px solid #ccc;
    }

    img {
        height: 44pt;
        width: auto;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    span {
        display: none;
    }
`;

export const PrintFilterSummary = styled.div`
    display: none;

    @media print {
        display: block !important;
        margin-bottom: 12pt;
        padding: 8pt 10pt;
        border: 1pt solid #ccc;
        border-radius: 4pt;
        font-size: 9pt;
        color: #444;
        background: #f9f9f9;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    .pfs-label {
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-size: 8pt;
        color: #666;
        margin-bottom: 3pt;
    }

    .pfs-criteria {
        font-size: 9.5pt;
        color: #222;
        margin-bottom: 4pt;
    }

    .pfs-date {
        font-size: 8pt;
        color: #888;
    }
`;