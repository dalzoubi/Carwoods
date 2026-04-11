import React from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heading, SubHeading, Paragraph, InlineLink } from '../styles';
import { withDarkPath } from '../routePaths';

const TermsOfService = () => {
    const { pathname } = useLocation();
    const { t } = useTranslation();

    return (
        <div>
            <Helmet>
                <title>{t('terms.title')}</title>
                <meta name="description" content={t('terms.metaDescription')} />
            </Helmet>

            <Heading>{t('terms.heading')}</Heading>
            <Paragraph>{t('terms.intro')}</Paragraph>

            <SubHeading>{t('terms.useOfSiteHeading')}</SubHeading>
            <Paragraph>{t('terms.useOfSiteBody')}</Paragraph>

            <SubHeading>{t('terms.listingsHeading')}</SubHeading>
            <Paragraph>{t('terms.listingsBody')}</Paragraph>

            <SubHeading>{t('terms.thirdPartyHeading')}</SubHeading>
            <Paragraph>{t('terms.thirdPartyBody')}</Paragraph>

            <SubHeading>{t('terms.eligibilityHeading')}</SubHeading>
            <Paragraph>{t('terms.eligibilityBody')}</Paragraph>

            <SubHeading>{t('terms.prohibitedUseHeading')}</SubHeading>
            <Paragraph>{t('terms.prohibitedUseBody')}</Paragraph>

            <SubHeading>{t('terms.liabilityHeading')}</SubHeading>
            <Paragraph>{t('terms.liabilityBody')}</Paragraph>

            <SubHeading>{t('terms.legalNoticeHeading')}</SubHeading>
            <Paragraph>{t('terms.legalNoticeBody')}</Paragraph>

            <SubHeading>{t('terms.changesHeading')}</SubHeading>
            <Paragraph>{t('terms.changesBody')}</Paragraph>

            <SubHeading>{t('terms.notificationsHeading')}</SubHeading>
            <Paragraph>{t('terms.notificationsBody')}</Paragraph>

            <SubHeading>{t('terms.contactHeading')}</SubHeading>
            <Paragraph>
                {t('terms.contactBody')}{' '}
                <InlineLink href={withDarkPath(pathname, '/contact-us')}>{t('terms.contactLink')}</InlineLink>
                {' '}{t('terms.contactBodySuffix')}
            </Paragraph>

            <Paragraph>
                <em>{t('terms.lastUpdated')}</em>
            </Paragraph>
        </div>
    );
};

export default TermsOfService;
