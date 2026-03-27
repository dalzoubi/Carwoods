import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { withDarkPath } from '../routePaths';
import { Helmet } from 'react-helmet';
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

const StepList = styled.ol`
    margin: ${theme.spacing(2)} 0;
    padding-left: ${theme.spacing(3)};
    font-size: var(--typography-body1-font-size);
    line-height: var(--typography-body1-line-height);

    li {
        margin-bottom: ${theme.spacing(1)};
    }
`;

const Apply = () => {
    const { pathname } = useLocation();
    return (
        <div>
            <Helmet>
                <title>Carwoods - How to Apply</title>
                <meta name="description" content="How to apply to rent a Carwoods property. Review criteria, gather documents, and submit your rental application online." />
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
                    <strong>Submit your application</strong> — Choose a property below to start the online application (RentSpree). Each card also links to the full listing for photos and details.
                    <RentalPropertyApplyTiles />
                </li>
            </StepList>
        </div>
    );
};

export default Apply;
