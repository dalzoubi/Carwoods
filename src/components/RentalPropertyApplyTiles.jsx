import React from 'react';
import styled from 'styled-components';
import theme from '../theme';
import { RENTAL_APPLY_PROPERTIES } from '../data/rentalPropertyApplyTiles.generated';

/** Opens in the browser; mobile OS typically offers the Maps app. */
function mapsSearchUrl(addressLine, cityStateZip) {
  const query = [addressLine, cityStateZip].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const TileGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr;
    gap: ${theme.spacing(2)};
    margin-top: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(0.5)};

    @media (min-width: 600px) {
        grid-template-columns: repeat(2, 1fr);
    }
`;

const TileCard = styled.article`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--palette-background-default);
    border: 1px solid var(--palette-divider, rgba(0, 0, 0, 0.12));
    border-radius: var(--shape-border-radius);
    overflow: hidden;
    box-shadow: var(--shadow-card);
    transition:
        box-shadow 0.2s ease,
        border-color 0.2s ease;

    &:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        border-color: var(--palette-primary-light);
    }

    &:has(a:focus-visible) {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 2px;
    }
`;

const PhotoLink = styled.a`
    display: block;
    position: relative;
    aspect-ratio: 4 / 3;
    background: var(--palette-action-hover);
    overflow: hidden;
    text-decoration: none;
    color: inherit;

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: -2px;
    }

    &:hover img {
        transform: scale(1.03);
    }
`;

const Photo = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.25s ease;
`;

const RentBadge = styled.span`
    position: absolute;
    top: ${theme.spacing(1)};
    right: ${theme.spacing(1)};
    padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
    background: var(--cta-button-bg);
    color: var(--cta-button-text);
    pointer-events: none;
`;

const TileBody = styled.div`
    padding: ${theme.spacing(1.5)};
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
`;

const AddressBlock = styled.div`
    font-size: var(--typography-body1-font-size);
    line-height: var(--typography-body1-line-height);
`;

const Street = styled.div`
    font-weight: 700;
    color: var(--palette-text-primary);
`;

const CityZip = styled.div`
    color: var(--palette-text-secondary);
    font-size: 0.9375rem;
`;

const AddressMapLink = styled.a`
    display: block;
    text-decoration: none;
    color: inherit;
    border-radius: 2px;
    transition: color 0.2s ease;

    &:hover ${Street},
    &:hover ${CityZip} {
        text-decoration: underline;
        text-underline-offset: 2px;
        color: var(--palette-primary-main);
    }

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 2px;
    }
`;

const DetailList = styled.ul`
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.875rem;
    line-height: 1.45;
    color: var(--palette-text-secondary);

    li + li {
        margin-top: 0.25rem;
    }
`;

const TextLink = styled.a`
    font-size: 0.9375rem;
    font-weight: 600;
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

const ApplyBlock = styled.div`
    margin-top: auto;
    padding-top: ${theme.spacing(0.5)};
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(0.75)};
    align-items: flex-start;
`;

const RentalPropertyApplyTiles = () => {
  if (!RENTAL_APPLY_PROPERTIES.length) {
    return null;
  }

  return (
    <TileGrid>
      {RENTAL_APPLY_PROPERTIES.map((p) => {
        const applyLabel = `Apply for ${p.addressLine} — opens rental application (new tab)`;
        const detailsLabel = `Full listing details for ${p.addressLine} (opens in new tab)`;
        return (
          <TileCard key={p.id}>
            <PhotoLink
              href={p.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={applyLabel}
            >
              <Photo src={p.photoUrl} alt="" loading="lazy" decoding="async" />
              <RentBadge>{p.monthlyRentLabel}</RentBadge>
            </PhotoLink>
            <TileBody>
              <AddressBlock>
                <AddressMapLink
                  href={mapsSearchUrl(p.addressLine, p.cityStateZip)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open map for ${p.addressLine}, ${p.cityStateZip} (new tab)`}
                >
                  <Street>{p.addressLine}</Street>
                  <CityZip>{p.cityStateZip}</CityZip>
                </AddressMapLink>
              </AddressBlock>
              <DetailList>
                {p.detailLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </DetailList>
              <ApplyBlock>
                <TextLink href={p.applyUrl} target="_blank" rel="noopener noreferrer">
                  Apply now (RentSpree)
                </TextLink>
                <TextLink href={p.harListingUrl} target="_blank" rel="noopener noreferrer" aria-label={detailsLabel}>
                  Full property details
                </TextLink>
              </ApplyBlock>
            </TileBody>
          </TileCard>
        );
      })}
    </TileGrid>
  );
};

export default RentalPropertyApplyTiles;
