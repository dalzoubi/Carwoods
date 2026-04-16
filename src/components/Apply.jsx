import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { withDarkPath } from '../routePaths';
import SeoHead from './SeoHead';
import { organizationSchema } from '../seo/structuredData';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import { Heading, Paragraph, PageHeader } from '../styles';
import theme from '../theme';
import RentalPropertyApplyTiles from './RentalPropertyApplyTiles';

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

const StepTrack = styled.ol`
    list-style: none;
    margin: ${theme.spacing(3)} 0 ${theme.spacing(2)};
    padding: 0;
`;

const StepItem = styled.li`
    display: flex;
    gap: ${theme.spacing(2)};
    align-items: stretch;
    margin: 0;
    padding: 0;

    &:not(:last-child) {
        margin-bottom: ${theme.spacing(2)};
    }

    @media (min-width: 600px) {
        gap: ${theme.spacing(2.5)};
    }
`;

const StepRail = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 2.75rem;
`;

const StepBadge = styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    font-weight: 700;
    font-size: 1rem;
    line-height: 1;
    flex-shrink: 0;
    background: var(--cta-button-bg);
    color: var(--cta-button-text);
    box-shadow: var(--shadow-card);
`;

const StepConnector = styled.span`
    flex: 1;
    width: 2px;
    margin-top: ${theme.spacing(1)};
    min-height: ${theme.spacing(2)};
    background: var(--palette-divider, rgba(0, 0, 0, 0.12));
    border-radius: 1px;

    ${StepItem}:last-child & {
        display: none;
    }
`;

const StepBody = styled.div`
    flex: 1;
    min-width: 0;
    background: var(--palette-background-paper);
    border: 1px solid var(--palette-divider, rgba(0, 0, 0, 0.12));
    border-radius: var(--shape-border-radius);
    padding: ${theme.spacing(2)} ${theme.spacing(2.5)};
    box-shadow: var(--shadow-card);
    font-size: var(--typography-body1-font-size);
    line-height: var(--typography-body1-line-height);
    color: var(--palette-text-primary);
    transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;

    &:hover,
    &:has(a:focus-visible) {
        border-color: var(--palette-primary-light);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    }
`;

const StepHeading = styled.h2`
    margin: 0 0 ${theme.spacing(1)} 0;
    font-size: var(--typography-h3-font-size);
    font-weight: var(--typography-h3-font-weight);
    line-height: 1.3;
    color: var(--palette-text-primary);
`;

const StepDescription = styled.p`
    margin: 0;
    color: var(--palette-text-primary);
`;

const Apply = () => {
    const { pathname } = useLocation();
    const { t } = useTranslation();
    return (
        <div>
            <SeoHead
                title={t('apply.title')}
                description={t('apply.metaDescription')}
                path="/apply"
                jsonLd={organizationSchema}
            />
            <PageHeader>
                <Heading>{t('apply.heading')}</Heading>
            </PageHeader>

            <Paragraph>
                {t('apply.intro')}
            </Paragraph>

            <StepTrack aria-label={t('apply.stepsLabel')}>
                <StepItem>
                    <StepRail>
                        <StepBadge aria-hidden="true">1</StepBadge>
                        <StepConnector aria-hidden="true" />
                    </StepRail>
                    <StepBody>
                        <StepHeading>{t('apply.step1Heading')}</StepHeading>
                        <StepDescription>
                            {t('apply.step1Body')}{' '}
                            <InternalLink to={withDarkPath(pathname, '/tenant-selection-criteria')}>
                                {t('apply.step1LinkText')}
                            </InternalLink>
                            .
                        </StepDescription>
                    </StepBody>
                </StepItem>
                <StepItem>
                    <StepRail>
                        <StepBadge aria-hidden="true">2</StepBadge>
                        <StepConnector aria-hidden="true" />
                    </StepRail>
                    <StepBody>
                        <StepHeading>{t('apply.step2Heading')}</StepHeading>
                        <StepDescription>
                            {t('apply.step2Body')}{' '}
                            <InternalLink to={withDarkPath(pathname, '/application-required-documents')}>
                                {t('apply.step2LinkText')}
                            </InternalLink>{' '}
                            {t('apply.step2BodySuffix')}
                        </StepDescription>
                    </StepBody>
                </StepItem>
                <StepItem>
                    <StepRail>
                        <StepBadge aria-hidden="true">3</StepBadge>
                        <StepConnector aria-hidden="true" />
                    </StepRail>
                    <StepBody>
                        <StepHeading>{t('apply.step3Heading')}</StepHeading>
                        <StepDescription>
                            {t('apply.step3Body')}
                        </StepDescription>
                        <RentalPropertyApplyTiles />
                    </StepBody>
                </StepItem>
            </StepTrack>
        </div>
    );
};

export default Apply;
