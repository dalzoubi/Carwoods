import React, { useCallback, forwardRef } from 'react';
import styled from 'styled-components';
import { NavLink as RouterNavLink } from 'react-router-dom';
import theme from '../theme';

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
        window.history.pushState(null, '', `#${id}`);
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
        window.history.pushState(null, '', href);
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
