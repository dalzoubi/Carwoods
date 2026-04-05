import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

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
        margin-inline-end: 5px;
    }
`;

const FooterLink = styled.a`
    ${linkStyles}
`;

const FooterInternalLink = styled(RouterLink)`
    ${linkStyles}
`;

const FooterSeparator = styled.span`
    color: var(--footer-separator-on-primary);
    margin: 0 2px;
    user-select: none;
`;

const Footer = () => {
    const { t } = useTranslation();
    return (
        <FooterContainer>
            <p>{t('footer.copyright')}</p>
            <FooterLink href="https://www.trec.texas.gov/sites/default/files/pdf-forms/CN%201-2.pdf" target="_blank" rel="noopener noreferrer" aria-label={t('footer.trecNoticeAriaLabel')}>
                {t('footer.trecNotice')}
            </FooterLink>
            <FooterSeparator aria-hidden="true">|</FooterSeparator>
            <FooterLink href="https://members.har.com/mhf/terms/dispBrokerInfo.cfm?sitetype=aws&cid=735771" target="_blank" rel="noopener noreferrer" aria-label={t('footer.trecBrokerageAriaLabel')}>
                {t('footer.trecBrokerage')}
            </FooterLink>
            <FooterSeparator aria-hidden="true">|</FooterSeparator>
            <FooterInternalLink to="/privacy">{t('nav.privacy')}</FooterInternalLink>
            <FooterSeparator aria-hidden="true">|</FooterSeparator>
            <FooterInternalLink to="/accessibility">{t('nav.accessibility')}</FooterInternalLink>
        </FooterContainer>
    );
};

export default Footer;
