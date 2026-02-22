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
        color: ${theme.palette.text.secondary};
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

export const Paragraph = styled.p`
    line-height: ${theme.typography.body1.lineHeight};
    font-size: ${theme.typography.body1.fontSize};
`;

export const nestedListStyle = { listStyleType: 'lower-alpha' };