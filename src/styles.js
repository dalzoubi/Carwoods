import React, { useCallback } from 'react';
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

export const nestedListStyle = { listStyleType: 'lower-alpha' };