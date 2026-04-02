import React, { useCallback, useState, forwardRef } from 'react';
import styled from 'styled-components';
import { NavLink as RouterNavLink } from 'react-router-dom';
import theme from './theme';

/** Full-height column: header + growing main + footer pinned to viewport bottom on short pages */
export const AppShell = styled.div.attrs({ 'data-layout': 'app-shell' })`
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
`;

export const Container = styled.main`
    font-family: var(--typography-font-family);
    color: var(--palette-text-secondary);
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    /* Tighter gutters on phones so content uses width; sm+ matches historical spacing */
    padding: ${theme.spacing(1.5)};
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;

    @media (min-width: 600px) {
        padding: ${theme.spacing(2.5)};
    }
`;

export const Content = styled.section`
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin-top: ${theme.spacing(1.5)};
    padding: ${theme.spacing(1.5)};
    background: var(--palette-background-paper);
    border-radius: var(--shape-border-radius);
    box-shadow: var(--shadow-card);
    color: var(--palette-text-secondary);
    animation: pageFadeIn 0.25s ease-out;

    @media (min-width: 600px) {
        margin-top: ${theme.spacing(2.5)};
        padding: ${theme.spacing(2.5)};
    }

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

export const TocPageLayoutGrid = styled.div.attrs({ 'data-toc-page-layout': true })`
    display: block;

    @media (min-width: 1200px) {
        display: grid;
        grid-template-columns: minmax(200px, 270px) minmax(0, 1fr);
        gap: ${theme.spacing(3)};
        align-items: start;
    }

    @media print {
        display: block !important;
    }
`;

export const TocPageAside = styled.aside.attrs({ 'data-toc-aside': true })`
    @media (min-width: 1200px) {
        position: sticky;
        top: calc(var(--sticky-nav-offset, 48px) + 12px);
        max-height: calc(100dvh - var(--sticky-nav-offset, 48px) - 24px);
        overflow-y: auto;
        align-self: start;
    }

    @media print {
        position: static !important;
        max-height: none !important;
        overflow: visible !important;
    }

    & > nav {
        @media (min-width: 1200px) {
            margin-top: 0;
            margin-bottom: 0;
        }
    }
`;

export const TocPageMain = styled.div.attrs({ 'data-toc-page-main': true })`
    min-width: 0;
`;

const TocNavBase = styled.nav`
    background: var(--toc-nav-bg);
    border-inline-start: 4px solid var(--palette-primary-main);
    border-start-start-radius: 0;
    border-start-end-radius: var(--shape-border-radius);
    border-end-end-radius: var(--shape-border-radius);
    border-end-start-radius: 0;
    padding: ${theme.spacing(1.5)} ${theme.spacing(2.5)};
    margin: ${theme.spacing(2)} 0 ${theme.spacing(3)};

    ol,
    ul {
        margin: ${theme.spacing(0.5)} 0;
        padding-inline-start: ${theme.spacing(2.5)};
    }

    li {
        margin: ${theme.spacing(0.5)} 0;
        font-size: var(--typography-body1-font-size);
    }

    a {
        color: var(--palette-primary-main);
        text-decoration: none;
        text-underline-offset: 2px;
        display: inline-block;
        border-radius: 4px;
        padding: 2px 4px;
        margin: -2px -4px;
        transition:
            background-color 0.15s ease,
            color 0.15s ease;

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

    a.toc-scroll-spy-active {
        font-weight: 600;
        color: var(--toc-link-active-fg);
        background-color: var(--toc-link-active-bg);
        text-decoration: none;
    }
`;

export const TocNav = forwardRef(({ children, ...props }, ref) => {
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

    const handleKeyDown = useCallback((e) => {
        const root = e.currentTarget;
        const anchor = e.target.closest?.('a[href^="#"]');
        if (!anchor || !root.contains(anchor)) return;

        const links = Array.from(root.querySelectorAll('a[href^="#"]'));
        if (links.length === 0) return;
        const idx = links.indexOf(anchor);
        if (idx === -1) return;

        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            anchor.click();
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (idx < links.length - 1) links[idx + 1].focus();
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (idx > 0) links[idx - 1].focus();
            return;
        }
        if (e.key === 'Home') {
            e.preventDefault();
            links[0].focus();
            return;
        }
        if (e.key === 'End') {
            e.preventDefault();
            links[links.length - 1].focus();
            return;
        }
    }, []);

    return React.createElement(TocNavBase, { ref, onClick: handleClick, onKeyDown: handleKeyDown, ...props }, children);
});
TocNav.displayName = 'TocNav';

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

/**
 * Same behavior as {@link BackToTop} links: smooth scroll to an in-page id and sync the URL hash.
 * @param {string} href Hash link, e.g. `#page-top`
 * @param {{ updateHistory?: boolean }} [options]
 * @returns {boolean} Whether a matching element was found
 */
export function scrollToHashAnchor(href, { updateHistory = true } = {}) {
    if (!href?.startsWith('#')) return false;
    const id = href.slice(1);
    const target = document.getElementById(id);
    if (!target) return false;
    if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth' });
    }
    if (updateHistory) {
        history.pushState(null, '', href);
    }
    return true;
}

export const BackToTop = ({ href, children, ...props }) => {
    const handleClick = useCallback((e) => {
        if (!href?.startsWith('#')) return;
        const id = href.slice(1);
        if (!document.getElementById(id)) return;
        e.preventDefault();
        scrollToHashAnchor(href);
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
        padding-block-end: 10pt;
        /* Logo prints via invert below; keep band explicitly white (matches global print div reset) */
        background: #fff !important;
        border-bottom: 1px solid #ccc;
        /* Match light-mode print output even when the app is in dark mode */
        color-scheme: light !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    span {
        display: none;
    }
`;

/** Navbar-style inverted mark on screen; hidden when printing (see PrintHeaderLogoPrint). */
export const PrintHeaderLogo = styled.img`
    height: 44pt;
    width: auto;
    filter: invert(1);
    forced-color-adjust: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;

    @media print {
        display: none !important;
    }
`;

/** Black-on-transparent asset from prebuild; visible only in print (no CSS filter). */
export const PrintHeaderLogoPrint = styled.img`
    display: none;
    height: 44pt;
    width: auto;
    forced-color-adjust: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;

    @media print {
        display: block !important;
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