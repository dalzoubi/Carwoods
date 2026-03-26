import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { withDarkPath } from '../routePaths';
import { Helmet } from 'react-helmet';
import styled from 'styled-components';
import { Heading, SubHeading, Paragraph, InlineLink, PageHeader } from '../styles';
import theme from '../theme';
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

const StepList = styled.ol`
    margin: ${theme.spacing(2)} 0;
    padding-left: ${theme.spacing(3)};
    font-size: var(--typography-body1-font-size);
    line-height: var(--typography-body1-line-height);

    li {
        margin-bottom: ${theme.spacing(1)};
    }
`;

const QuickLinksList = styled.ul`
    margin: ${theme.spacing(2)} 0;
    padding-left: ${theme.spacing(3)};

    li {
        margin-bottom: ${theme.spacing(0.75)};
        font-size: var(--typography-body1-font-size);
    }
`;

const HAR_URL = 'https://www.har.com';

const Apply = () => {
    const { pathname } = useLocation();
    return (
        <div>
            <Helmet>
                <title>Carwoods - How to Apply</title>
                <meta name="description" content="How to apply to rent a Carwoods property. Review criteria, gather documents, and submit via har.com." />
            </Helmet>
            <PageHeader>
                <Heading>How to Apply to Rent</Heading>
            </PageHeader>

            <Paragraph>
                All the information you need to apply is on this site. No need to call — follow the steps below.
            </Paragraph>

            <StepList>
                <li>
                    <strong>Check eligibility</strong> — Review our{' '}
                    <InternalLink to={withDarkPath(pathname, '/tenant-selection-criteria')}>Tenant Selection Criteria</InternalLink>.
                </li>
                <li>
                    <strong>Gather your documents</strong> — Use our{' '}
                    <InternalLink to={withDarkPath(pathname, '/application-required-documents')}>Required Documents</InternalLink> list so your application is complete.
                </li>
                <li>
                    <strong>Submit your application</strong> — Go to the property page on <InlineLink href={HAR_URL} target="_blank" rel="noopener noreferrer" aria-label="har.com (opens in new tab)">har.com</InlineLink> to submit.
                </li>
            </StepList>

            <SubHeading>Quick links</SubHeading>
            <QuickLinksList>
                <li>
                    <InternalLink to={withDarkPath(pathname, '/tenant-selection-criteria')}>Tenant Selection Criteria</InternalLink>
                </li>
                <li>
                    <InternalLink to={withDarkPath(pathname, '/application-required-documents')}>Application Required Documents</InternalLink>
                </li>
                <li>
                    <InlineLink href={HAR_URL} target="_blank" rel="noopener noreferrer" aria-label="har.com – submit via the property listing (opens in new tab)">
                        har.com (submit via the property listing)
                    </InlineLink>
                </li>
                <li>
                    <InternalLink to={withDarkPath(pathname, '/contact-us')}>Contact Us</InternalLink> (for other questions)
                </li>
            </QuickLinksList>
        </div>
    );
};

export default Apply;
