import styled from 'styled-components';
import { NavLink as RouterNavLink } from 'react-router-dom';
import theme from './theme';

export const Container = styled.main`
    font-family: 'Helvetica Neue', sans-serif;
    color: ${theme.textSecondary};
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
`;

export const Content = styled.section`
    margin-top: 20px;
    padding: 20px;
    background: #e0e0e0; /* Darker background */
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    color: #333; /* Darker text color */
`;

export const NavLink = styled(RouterNavLink)`
    color: ${theme.textPrimary};
    text-decoration: none;
    font-weight: bold;
    padding: 0.5rem 1rem;
    transition: background 0.3s;

    &.active {
        background: #115293; /* Darker shade of blue */
        border-radius: 4px;
    }

    &:hover {
        background: #115293; /* Darker shade of blue */
        border-radius: 4px;
    }
`;

export const Heading = styled.h1`
    color: ${theme.primary}; /* Set color to primary (blue) */
    font-size: 2.5rem;
    margin-bottom: 10px;
`;

export const Paragraph = styled.p`
    line-height: 1.6;
    font-size: 1.1rem;
`;
