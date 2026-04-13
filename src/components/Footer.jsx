import React from 'react';
import styled from 'styled-components';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
    const { pathname } = useLocation();
    return (
        <FooterContainer>
            <p>{t('footer.copyright')}</p>
            <FooterInternalLink to={withDarkPath(pathname, '/pricing')} aria-label={t('footer.pricingAriaLabel')}>
                {t('footer.pricing')}
            </FooterInternalLink>
            <FooterSeparator aria-hidden="true">|</FooterSeparator>
            <FooterInternalLink to={withDarkPath(pathname, '/features')} aria-label={t('footer.featuresAriaLabel')}>
                {t('footer.features')}
            </FooterInternalLink>
            <FooterSeparator aria-hidden="true">|</FooterSeparator>
            <FooterInternalLink to={withDarkPath(pathname, '/for-property-managers')} aria-label={t('footer.forPropertyManagersAriaLabel')}>
                {t('footer.forPropertyManagers')}
            </FooterInternalLink>
            <FooterSeparator aria-hidden="true">|</FooterSeparator>
            <FooterInternalLink to={withDarkPath(pathname, '/privacy')} aria-label={t('footer.privacyPolicyAriaLabel')}>
                {t('footer.privacyPolicy')}
            </FooterInternalLink>
            <FooterSeparator aria-hidden="true">|</FooterSeparator>
            <FooterInternalLink to={withDarkPath(pathname, '/terms-of-service')} aria-label={t('footer.termsOfUseAriaLabel')}>
                {t('footer.termsOfUse')}
            </FooterInternalLink>
            <FooterSeparator aria-hidden="true">|</FooterSeparator>
            <FooterLink href="https://www.trec.texas.gov/sites/default/files/pdf-forms/CN%201-2.pdf" target="_blank" rel="noopener noreferrer" aria-label={t('footer.trecNoticeAriaLabel')}>
                {t('footer.trecNotice')}
            </FooterLink>
            <FooterSeparator aria-hidden="true">|</FooterSeparator>
            <FooterLink href="https://members.har.com/mhf/terms/dispBrokerInfo.cfm?sitetype=aws&cid=735771" target="_blank" rel="noopener noreferrer" aria-label={t('footer.trecBrokerageAriaLabel')}>
                {t('footer.trecBrokerage')}
            </FooterLink>
        </FooterContainer>
    );
};

export default Footer;
