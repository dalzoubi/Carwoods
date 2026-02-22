import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import theme from '../theme';

const FooterContainer = styled.footer`
    background-color: ${theme.palette.primary.main}; /* Match header color */
    color: ${theme.palette.text.primary};
    text-align: center;
    padding: 1rem;
    width: 100%; /* Ensure it takes full width */
    position: relative; /* Prevent any fixed positioning */
    bottom: 0; /* Stick to the bottom of the page */
`;

const linkStyles = `
    color: ${theme.palette.text.link};
    text-decoration: none;
    margin: 0 10px;
    font-size: 1.1rem;
    display: inline-flex;
    align-items: center;

    &:hover {
        text-decoration: underline;
    }

    svg {
        margin-right: 5px;
    }
`;

const FooterLink = styled.a`
    ${linkStyles}
`;

const FooterLinkInternal = styled(Link)`
    ${linkStyles}
`;

const Footer = () => {
    return (
        <FooterContainer aria-label="footer">
            <p>&copy; 2026 Carwoods LLC. All rights reserved.</p>
            <FooterLink href="https://www.trec.texas.gov/sites/default/files/pdf-forms/CN%201-2.pdf" target="_blank" rel="noopener noreferrer" aria-label="Texas Real Estate Commission Consumer Protection Notice (opens in new tab)">
                Texas Real Estate Commission Consumer Protection Notice
            </FooterLink>
            |
            <FooterLink href="https://members.har.com/mhf/terms/dispBrokerInfo.cfm?sitetype=aws&cid=735771" target="_blank" rel="noopener noreferrer" aria-label="Texas Real Estate Commission Information About Brokerage Services (opens in new tab)">
                Texas Real Estate Commission Information About Brokerage Services
            </FooterLink>
            |
            <FooterLinkInternal to="/privacy">Privacy Policy</FooterLinkInternal>
            |
            <FooterLinkInternal to="/accessibility">Accessibility</FooterLinkInternal>
        </FooterContainer>
    );
};

export default Footer;
