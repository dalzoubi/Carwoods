import React from 'react';
import SeoHead from './SeoHead';
import { organizationSchema } from '../seo/structuredData';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heading, SubHeading, Paragraph, InlineLink } from '../styles';
import { withDarkPath } from '../routePaths';

const Privacy = () => {
    const { pathname } = useLocation();
    const { t } = useTranslation();
    return (
        <div>
            <SeoHead
                title={t('privacy.title')}
                description={t('privacy.metaDescription')}
                path="/privacy"
                noIndex
                jsonLd={organizationSchema}
            />
            <Heading>{t('privacy.heading')}</Heading>
            <Paragraph>
                {t('privacy.intro')}
            </Paragraph>

            <SubHeading>{t('privacy.collectHeading')}</SubHeading>
            <Paragraph>
                {t('privacy.collectBody')}
            </Paragraph>

            <SubHeading>{t('privacy.leaseLifecycleHeading')}</SubHeading>
            <Paragraph>
                {t('privacy.leaseLifecycleBody')}
            </Paragraph>

            <SubHeading>{t('privacy.useHeading')}</SubHeading>
            <Paragraph>
                {t('privacy.useBody')}
            </Paragraph>

            <SubHeading>{t('privacy.thirdPartyHeading')}</SubHeading>
            <Paragraph>
                {t('privacy.thirdPartyBody')}
            </Paragraph>

            <SubHeading>{t('privacy.notificationsHeading')}</SubHeading>
            <Paragraph>
                {t('privacy.notificationsBody')}
            </Paragraph>

            <SubHeading>{t('privacy.aiHeading')}</SubHeading>
            <Paragraph>
                {t('privacy.aiBody')}
            </Paragraph>

            <SubHeading>{t('privacy.contactHeading')}</SubHeading>
            <Paragraph>
                {t('privacy.contactBody')}{' '}
                <InlineLink href={withDarkPath(pathname, '/contact-us')}>{t('privacy.contactLink')}</InlineLink>
                {' '}{t('privacy.contactBodySuffix')}
            </Paragraph>

            <Paragraph>
                <em>{t('privacy.lastUpdated')}</em>
            </Paragraph>
        </div>
    );
};

export default Privacy;
