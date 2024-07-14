import styled from 'styled-components';
import { NavLink as RouterNavLink } from 'react-router-dom';
import theme from './theme';

export const Container = styled.main`
    font-family: 'Helvetica Neue', sans-serif;
    color: ${theme.palette.text.secondary};
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
`;

export const Content = styled.section`
    margin-top: 20px;
    padding: 20px;
    background: ${theme.palette.background.paper};
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
        background: ${theme.palette.primary.light};
        color: ${theme.palette.text.secondary};
        border-radius: 4px;
    }
`;

export const Heading = styled.h1`
    color: ${theme.palette.primary.main};
    font-size: 2.5rem;
    margin-bottom: 10px;
`;

export const Paragraph = styled.p`
    line-height: 1.6;
    font-size: 1.1rem;
`;
