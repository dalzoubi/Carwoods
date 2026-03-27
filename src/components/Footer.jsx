import React from 'react';
import styled from 'styled-components';
import { Link, useLocation } from 'react-router-dom';
import { withDarkPath } from '../routePaths';

const FooterContainer = styled.footer`
    background-color: var(--palette-app-chrome-main);
    color: var(--footer-on-primary);
    text-align: center;
    padding: 1rem;
    width: 100%;
    flex-shrink: 0;
    box-sizing: border-box;
`;

const linkStyles = `
    color: var(--footer-link-on-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
    margin: 0 10px;
    font-size: 1.1rem;
    display: inline-flex;
    align-items: center;

    &:hover {
        color: var(--footer-link-hover-on-primary);
    }

    &:focus-visible {
        outline: 2px solid var(--footer-link-hover-on-primary);
        outline-offset: 3px;
        border-radius: 2px;
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

const FooterSeparator = styled.span`
    color: var(--footer-separator-on-primary);
    margin: 0 2px;
    user-select: none;
`;

const Footer = () => {
    const { pathname } = useLocation();
    return (
        <FooterContainer>
            <p>&copy; 2026 Carwoods. All rights reserved.</p>
            <FooterLink href="https://www.trec.texas.gov/sites/default/files/pdf-forms/CN%201-2.pdf" target="_blank" rel="noopener noreferrer" aria-label="Texas Real Estate Commission Consumer Protection Notice (opens in new tab)">
                Texas Real Estate Commission Consumer Protection Notice
            </FooterLink>
            <FooterSeparator aria-hidden="true">|</FooterSeparator>
            <FooterLink href="https://members.har.com/mhf/terms/dispBrokerInfo.cfm?sitetype=aws&cid=735771" target="_blank" rel="noopener noreferrer" aria-label="Texas Real Estate Commission Information About Brokerage Services (opens in new tab)">
                Texas Real Estate Commission Information About Brokerage Services
            </FooterLink>
            <FooterSeparator aria-hidden="true">|</FooterSeparator>
            <FooterLinkInternal to={withDarkPath(pathname, '/privacy')}>Privacy Policy</FooterLinkInternal>
            <FooterSeparator aria-hidden="true">|</FooterSeparator>
            <FooterLinkInternal to={withDarkPath(pathname, '/accessibility')}>Accessibility</FooterLinkInternal>
        </FooterContainer>
    );
};

export default Footer;
