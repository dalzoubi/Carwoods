import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { Heading, Paragraph, Button } from '../styles';

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

const HAR_AGENT_URL = 'https://www.har.com/dennis-alzoubi/agent_dalzoubi';

const ContactUs = () => {
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
                <InternalLink to="/apply">{t('contact.applyLinkText')}</InternalLink>
                {' '}{t('contact.para1Suffix')}
            </Paragraph>
            <Paragraph>
                {t('contact.para2')}
            </Paragraph>
            <p>
                <Button
                    href={HAR_AGENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('contact.ctaAriaLabel')}
                >
                    {t('contact.ctaButton')}
                </Button>
            </p>
        </div>
    );
};

export default ContactUs;
