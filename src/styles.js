import React, { useCallback, useState } from 'react';
import styled from 'styled-components';
import { NavLink as RouterNavLink } from 'react-router-dom';
import theme, { shadowCard } from './theme';

export const Container = styled.main`
    font-family: ${theme.typography.fontFamily};
    color: ${theme.palette.text.secondary};
    max-width: 1200px;
    margin: 0 auto;
    padding: ${theme.spacing(2.5)};
`;

export const Content = styled.section`
    margin-top: ${theme.spacing(2.5)};
    padding: ${theme.spacing(2.5)};
    background: ${theme.palette.background.paper};
    border-radius: ${theme.shape.borderRadius}px;
    box-shadow: ${shadowCard};
    color: ${theme.palette.text.secondary};
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
    color: ${theme.palette.text.primary};
    text-decoration: none;
    font-weight: bold;
    padding: 0.5rem 1rem;
    transition: background 0.3s, color 0.3s;

    &.active {
        background: ${theme.palette.primary.dark};
        border-radius: 4px;
    }

    &:hover {
        background: ${theme.palette.drawer.hover};
        color: #ffffff;
        border-radius: 4px;
    }

    &:focus-visible {
        outline: 2px solid ${theme.palette.primary.light};
        outline-offset: 2px;
    }
`;

export const Heading = styled.h1`
    color: ${theme.palette.primary.main};
    font-size: ${theme.typography.h1.fontSize};
    font-weight: ${theme.typography.h1.fontWeight};
    margin-bottom: ${theme.spacing(1.25)};
`;

export const SubHeading = styled.h2`
    color: ${theme.palette.primary.main};
    font-size: ${theme.typography.h2.fontSize};
    font-weight: ${theme.typography.h2.fontWeight};
    margin-top: ${theme.spacing(3)};
    margin-bottom: ${theme.spacing(1)};
    padding-bottom: ${theme.spacing(0.5)};
    border-bottom: 2px solid ${theme.palette.primary.light};
`;

export const SectionHeading = styled.h3`
    color: ${theme.palette.text.secondary};
    font-size: ${theme.typography.h3.fontSize};
    font-weight: ${theme.typography.h3.fontWeight};
    margin-top: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(0.75)};
`;

export const Paragraph = styled.p`
    line-height: ${theme.typography.body1.lineHeight};
    font-size: ${theme.typography.body1.fontSize};
`;

export const InlineLink = styled.a`
    color: ${theme.palette.primary.main};
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.2s;

    &:hover {
        color: ${theme.palette.primary.dark};
    }

    &:visited {
        color: ${theme.palette.primary.dark};
    }

    &:focus-visible {
        outline: 2px solid ${theme.palette.primary.light};
        outline-offset: 2px;
        border-radius: 2px;
    }
`;

export const Button = styled.a`
    display: inline-block;
    padding: 12px 24px;
    background-color: ${theme.palette.primary.main};
    color: ${theme.palette.text.primary};
    border-radius: ${theme.shape.borderRadius}px;
    font-weight: bold;
    font-size: ${theme.typography.body1.fontSize};
    text-decoration: none;
    transition: background-color 0.2s;

    &:hover {
        background-color: ${theme.palette.primary.dark};
        color: ${theme.palette.text.primary};
    }

    &:focus-visible {
        outline: 2px solid ${theme.palette.primary.light};
        outline-offset: 3px;
    }
`;

const TocNavBase = styled.nav`
    background: #f0f4ff;
    border-left: 4px solid ${theme.palette.primary.main};
    border-radius: 0 ${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0;
    padding: ${theme.spacing(1.5)} ${theme.spacing(2.5)};
    margin: ${theme.spacing(2)} 0 ${theme.spacing(3)};

    ol, ul {
        margin: ${theme.spacing(0.5)} 0;
        padding-left: ${theme.spacing(2.5)};
    }

    li {
        margin: ${theme.spacing(0.5)} 0;
        font-size: ${theme.typography.body1.fontSize};
    }

    a {
        color: ${theme.palette.primary.main};
        text-decoration: none;
        text-underline-offset: 2px;

        &:hover {
            text-decoration: underline;
            color: ${theme.palette.primary.dark};
        }

        &:focus-visible {
            outline: 2px solid ${theme.palette.primary.light};
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
    color: ${theme.palette.primary.main};
    font-size: ${theme.typography.body1.fontSize};
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
        color: ${theme.palette.primary.dark};
    }

    &:focus-visible {
        outline: 2px solid ${theme.palette.primary.light};
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

export const DetailsSummary = styled.summary`
    cursor: pointer;
    color: ${theme.palette.primary.main};
    font-weight: 600;
    font-size: ${theme.typography.body1.fontSize};
    padding: ${theme.spacing(0.75)} 0;
    user-select: none;
    list-style: none;

    &::before {
        content: '▶ ';
        font-size: 0.75em;
        transition: transform 0.2s;
        display: inline-block;
    }

    &:hover {
        color: ${theme.palette.primary.dark};
    }

    &:focus-visible {
        outline: 2px solid ${theme.palette.primary.light};
        outline-offset: 2px;
        border-radius: 2px;
    }

    details[open] > &::before {
        content: '▼ ';
    }
`;

const BackToTopBase = styled.a`
    display: inline-block;
    margin-top: ${theme.spacing(1.5)};
    font-size: ${theme.typography.body2?.fontSize ?? '0.875rem'};
    color: ${theme.palette.primary.main};
    text-decoration: none;
    text-underline-offset: 2px;

    &:hover {
        text-decoration: underline;
        color: ${theme.palette.primary.dark};
    }

    &:focus-visible {
        outline: 2px solid ${theme.palette.primary.light};
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

export const PageHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${theme.spacing(1.25)};

    h1 {
        margin-bottom: 0;
    }
`;

export const PrintButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    padding: 0;
    background: transparent;
    color: ${theme.palette.primary.main};
    border: 1.5px solid ${theme.palette.primary.main};
    border-radius: ${theme.shape.borderRadius}px;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;

    svg {
        width: 22px;
        height: 22px;
        fill: currentColor;
    }

    &:hover {
        background: ${theme.palette.primary.main};
        color: #fff;
    }

    &:focus-visible {
        outline: 2px solid ${theme.palette.primary.light};
        outline-offset: 2px;
    }

    @media print {
        display: none !important;
    }
`;

export const FilteredSection = styled.section`
    &[data-filtered='true'] {
        display: none;
    }

    @media print {
        &[data-filtered='true'] {
            display: none !important;
        }
    }
`;

export const PersonalizeCard = styled.div`
    background: #f0f4ff;
    border-left: 4px solid ${theme.palette.primary.main};
    border-radius: 0 ${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0;
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
    font-size: ${theme.typography.body1.fontSize};
    font-weight: 600;
    color: ${theme.palette.primary.dark};
    margin: 0 0 ${theme.spacing(0.25)};

    @media (max-width: 480px) {
        font-size: 0.9rem;
    }
`;

export const PersonalizeCardDesc = styled.p`
    font-size: 0.875rem;
    color: ${theme.palette.text.secondary};
    margin: 0;

    @media (max-width: 480px) {
        font-size: 0.8rem;
    }
`;

export const PersonalizeCardButton = styled.button`
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    padding: ${theme.spacing(0.625)} ${theme.spacing(1.5)};
    background: ${theme.palette.primary.main};
    color: #fff;
    border: none;
    border-radius: ${theme.shape.borderRadius}px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;

    &:hover {
        background: ${theme.palette.primary.dark};
    }

    &:focus-visible {
        outline: 2px solid ${theme.palette.primary.light};
        outline-offset: 2px;
    }

    @media (max-width: 480px) {
        font-size: 0.8rem;
        padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
        gap: 0.3em;
    }
`;

export const FilterBanner = styled.div`
    background: #fff8e1;
    border-left: 4px solid #f59e0b;
    border-radius: 0 ${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0;
    padding: ${theme.spacing(1.5)} ${theme.spacing(2.5)};
    margin: ${theme.spacing(2)} 0 ${theme.spacing(3)};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing(2)};
    flex-wrap: wrap;

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
    color: #92400e;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 ${theme.spacing(0.5)};
`;

export const FilterBannerChips = styled.p`
    font-size: ${theme.typography.body1.fontSize};
    color: #78350f;
    margin: 0;
    font-weight: 500;
`;

export const FilterBannerActions = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1.5)};
    flex-shrink: 0;
    flex-wrap: wrap;
`;

export const FilterBannerEditButton = styled.button`
    display: inline-flex;
    align-items: center;
    padding: ${theme.spacing(0.5)} ${theme.spacing(1.5)};
    background: transparent;
    color: #92400e;
    border: 1.5px solid #f59e0b;
    border-radius: ${theme.shape.borderRadius}px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;

    &:hover {
        background: #fef3c7;
    }

    &:focus-visible {
        outline: 2px solid #f59e0b;
        outline-offset: 2px;
    }
`;

export const FilterBannerResetButton = styled.button`
    display: inline-flex;
    align-items: center;
    padding: ${theme.spacing(0.5)} ${theme.spacing(1.5)};
    background: #f59e0b;
    color: #fff;
    border: none;
    border-radius: ${theme.shape.borderRadius}px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;

    &:hover {
        background: #d97706;
    }

    &:focus-visible {
        outline: 2px solid #92400e;
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
        filter: invert(1);
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    span {
        display: none;
    }
`;