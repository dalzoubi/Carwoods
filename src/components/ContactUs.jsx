import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { Heading, Paragraph, Button } from '../styles';
import { withDarkPath } from '../routePaths';

const InternalLink = styled(Link)`
    color: var(--palette-primary-main);
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.2s;

    &:hover {
        color: var(--palette-primary-dark);
    }

    &:visited {
        color: var(--palette-primary-dark);
    }

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 2px;
        border-radius: 2px;
    }
`;

const ContactUs = () => {
    const { pathname } = useLocation();
    const { t } = useTranslation();
    return (
        <div>
            <Helmet>
                <title>{t('contact.title')}</title>
                <meta
                    name="description"
                    content={t('contact.metaDescription')}
                />
            </Helmet>
            <Heading>{t('contact.heading')}</Heading>
            <Paragraph>
                {t('contact.para1Prefix')}{' '}
                <a href="mailto:support@carwoods.com">support@carwoods.com</a>.{' '}
                {t('contact.para1Suffix')}
            </Paragraph>
            <Paragraph>
                {t('contact.para2')}{' '}
                <InternalLink to={withDarkPath(pathname, '/apply')}>{t('contact.applyLinkText2')}</InternalLink>
                {' '}{t('contact.para2Suffix')}
            </Paragraph>
            <p>
                <Button
                    href={t('contact.ctaEmailHref')}
                    aria-label={t('contact.ctaAriaLabel')}
                >
                    {t('contact.ctaButton')}
                </Button>
            </p>
        </div>
    );
};

export default ContactUs;
