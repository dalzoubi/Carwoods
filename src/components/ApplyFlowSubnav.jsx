import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import theme from '../theme';
import { withDarkPath } from '../routePaths';

const FlowNav = styled.nav`
    margin: ${theme.spacing(2)} 0 ${theme.spacing(2)};
    padding: ${theme.spacing(1.5)} ${theme.spacing(2)};
    background: var(--palette-background-paper);
    border: 1px solid var(--palette-divider, rgba(0, 0, 0, 0.12));
    border-radius: var(--shape-border-radius);
    box-shadow: var(--shadow-card);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${theme.spacing(1)} ${theme.spacing(2)};
    font-size: var(--typography-body1-font-size);
    line-height: 1.4;
    color: var(--palette-text-secondary);

    @media print {
        display: none;
    }
`;

const FlowLink = styled(Link)`
    color: var(--palette-primary-main);
    text-decoration: underline;
    text-underline-offset: 2px;
    font-weight: 600;
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

const FlowLinkSecondary = styled(FlowLink)`
    font-weight: 400;
`;

const MidDot = styled.span`
    color: var(--palette-text-disabled);
    user-select: none;

    @media (max-width: 599px) {
        display: none;
    }
`;

/**
 * Links back to the How to Apply hub and to the adjacent step in the rental apply flow.
 * @param {{ phase: 'eligibility' | 'documents' }} props
 */
export function ApplyFlowSubnav({ phase }) {
    const { pathname } = useLocation();
    const applyHref = withDarkPath(pathname, '/apply');
    const criteriaHref = withDarkPath(pathname, '/tenant-selection-criteria');
    const docsHref = withDarkPath(pathname, '/application-required-documents');

    return (
        <FlowNav aria-label="Apply process navigation">
            <FlowLink to={applyHref}>Back to How to Apply</FlowLink>
            <MidDot aria-hidden="true">·</MidDot>
            {phase === 'eligibility' ? (
                <FlowLinkSecondary to={docsHref}>Next: Required documents</FlowLinkSecondary>
            ) : (
                <FlowLinkSecondary to={criteriaHref}>Step 1: Tenant Selection Criteria</FlowLinkSecondary>
            )}
        </FlowNav>
    );
}
