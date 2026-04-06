import styled from 'styled-components';
import theme from '../theme';

export const Button = styled.a`
    display: inline-block;
    padding: 12px 24px;
    background-color: var(--cta-button-bg);
    color: var(--cta-button-text);
    border-radius: var(--shape-border-radius);
    font-weight: bold;
    font-size: var(--typography-body1-font-size);
    text-decoration: none;
    transition: background-color 0.2s, color 0.2s;

    &:hover {
        background-color: var(--cta-button-bg-hover);
        color: var(--cta-button-text);
    }

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 3px;
    }
`;

export const PersonalizeCardButton = styled.button.attrs({ type: 'button' })`
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    padding: ${theme.spacing(0.625)} ${theme.spacing(1.5)};
    background: var(--personalize-button-bg);
    color: var(--personalize-button-fg);
    border: none;
    border-radius: var(--shape-border-radius);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    white-space: nowrap;

    &:hover {
        background: var(--personalize-button-bg-hover);
        color: var(--personalize-button-fg-hover);
    }

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 2px;
    }

    @media (max-width: 480px) {
        font-size: 0.8rem;
        padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
        gap: 0.3em;
    }
`;

export const FilterBannerEditButton = styled.button`
    display: inline-flex;
    align-items: center;
    padding: ${theme.spacing(0.5)} ${theme.spacing(1.5)};
    background: transparent;
    color: var(--filter-banner-edit-color);
    border: 1.5px solid var(--filter-banner-border);
    border-radius: var(--shape-border-radius);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;

    &:hover {
        background: var(--filter-banner-edit-hover-bg);
    }

    &:focus-visible {
        outline: 2px solid var(--filter-banner-edit-outline);
        outline-offset: 2px;
    }
`;

export const FilterBannerResetButton = styled.button`
    display: inline-flex;
    align-items: center;
    padding: ${theme.spacing(0.5)} ${theme.spacing(1.5)};
    background: var(--filter-banner-reset-bg);
    color: #fff;
    border: none;
    border-radius: var(--shape-border-radius);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;

    &:hover {
        background: var(--filter-banner-reset-hover);
    }

    &:focus-visible {
        outline: 2px solid var(--filter-banner-reset-outline);
        outline-offset: 2px;
    }
`;
