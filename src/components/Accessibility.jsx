import React from 'react';
import SeoHead from './SeoHead';
import { organizationSchema } from '../seo/structuredData';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heading, SubHeading, Paragraph, InlineLink } from '../styles';
import { withDarkPath } from '../routePaths';

const Accessibility = () => {
    const { pathname } = useLocation();
    const { t } = useTranslation();
    return (
        <div>
            <SeoHead
                title={t('accessibility.title')}
                description={t('accessibility.metaDescription')}
                path="/accessibility"
                noIndex
                jsonLd={organizationSchema}
            />
            <Heading>{t('accessibility.heading')}</Heading>
            <Paragraph>
                {t('accessibility.intro')}
            </Paragraph>

            <SubHeading>{t('accessibility.measuresHeading')}</SubHeading>
            <ul>
                <li>{t('accessibility.measure1')}</li>
                <li>{t('accessibility.measure2')}</li>
                <li>{t('accessibility.measure3')}</li>
                <li>{t('accessibility.measure4')}</li>
                <li>{t('accessibility.measure5')}</li>
            </ul>

            <SubHeading>{t('accessibility.feedbackHeading')}</SubHeading>
            <Paragraph>
                {t('accessibility.feedbackBody')}{' '}
                <InlineLink href={withDarkPath(pathname, '/contact-us')}>{t('accessibility.feedbackLink')}</InlineLink>
                {' '}{t('accessibility.feedbackBodySuffix')}
            </Paragraph>

            <Paragraph>
                <em>{t('accessibility.lastUpdated')}</em>
            </Paragraph>
        </div>
    );
};

export default Accessibility;
