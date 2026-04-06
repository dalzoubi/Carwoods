import styled from 'styled-components';
import theme from '../theme';

export const Heading = styled.h1`
    color: var(--palette-primary-main);
    font-size: var(--typography-h1-font-size);
    font-weight: var(--typography-h1-font-weight);
    margin-bottom: ${theme.spacing(1.25)};
`;

export const SubHeading = styled.h2`
    color: var(--palette-primary-main);
    font-size: var(--typography-h2-font-size);
    font-weight: var(--typography-h2-font-weight);
    margin-top: ${theme.spacing(3)};
    margin-bottom: ${theme.spacing(1)};
    padding-bottom: ${theme.spacing(0.5)};
    border-bottom: 2px solid var(--palette-primary-light);
`;

export const SectionHeading = styled.h3`
    color: var(--palette-text-secondary);
    font-size: var(--typography-h3-font-size);
    font-weight: var(--typography-h3-font-weight);
    margin-top: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(0.75)};
`;

export const Paragraph = styled.p`
    line-height: var(--typography-body1-line-height);
    font-size: var(--typography-body1-font-size);
`;

export const InlineLink = styled.a`
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

export const nestedListStyle = { listStyleType: 'lower-alpha' };
export const nestedUlStyle = { listStyleType: 'disc' };
