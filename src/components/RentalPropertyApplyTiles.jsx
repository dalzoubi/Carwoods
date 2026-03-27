import React from 'react';
import styled from 'styled-components';
import theme from '../theme';
import { InlineLink } from '../styles';
import { RENTAL_APPLY_PROPERTIES } from '../data/rentalPropertyApplyTiles.generated';

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

const TileLink = styled.a`
    display: flex;
    flex-direction: column;
    height: 100%;
    text-decoration: none;
    color: inherit;
    background: var(--palette-background-default);
    border: 1px solid var(--palette-divider, rgba(0, 0, 0, 0.12));
    border-radius: var(--shape-border-radius);
    overflow: hidden;
    box-shadow: var(--shadow-card);
    transition:
        box-shadow 0.2s ease,
        border-color 0.2s ease,
        transform 0.15s ease;

    &:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        border-color: var(--palette-primary-light);
    }

    &:focus-visible {
        outline: 2px solid var(--palette-primary-light);
        outline-offset: 2px;
    }

    &:hover img {
        transform: scale(1.03);
    }
`;

const PhotoWrap = styled.div`
    position: relative;
    aspect-ratio: 4 / 3;
    background: var(--palette-action-hover);
    overflow: hidden;
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

const CtaRow = styled.div`
    margin-top: auto;
    padding-top: ${theme.spacing(0.5)};
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--palette-primary-main);
    text-decoration: underline;
    text-underline-offset: 2px;
`;

const HarNote = styled.p`
    margin: ${theme.spacing(1.5)} 0 0;
    font-size: var(--typography-body2-font-size, 0.875rem);
    line-height: var(--typography-body2-line-height, 1.43);
    color: var(--palette-text-secondary);
`;

const RentalPropertyApplyTiles = () => {
  if (!RENTAL_APPLY_PROPERTIES.length) {
    return null;
  }

  return (
    <>
      <TileGrid>
        {RENTAL_APPLY_PROPERTIES.map((p) => {
          const label = `Apply for ${p.addressLine} — opens rental application (new tab)`;
          return (
            <TileLink
              key={p.id}
              href={p.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
            >
              <PhotoWrap>
                <Photo src={p.photoUrl} alt="" loading="lazy" decoding="async" />
                <RentBadge>{p.monthlyRentLabel}</RentBadge>
              </PhotoWrap>
              <TileBody>
                <AddressBlock>
                  <Street>{p.addressLine}</Street>
                  <CityZip>{p.cityStateZip}</CityZip>
                </AddressBlock>
                <DetailList>
                  {p.detailLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </DetailList>
                <CtaRow>Apply now (RentSpree)</CtaRow>
              </TileBody>
            </TileLink>
          );
        })}
      </TileGrid>
      <HarNote>
        Photos and listing details match{' '}
        <InlineLink href="https://www.har.com" target="_blank" rel="noopener noreferrer">
          HAR.com
        </InlineLink>
        . View the full listing:{' '}
        {RENTAL_APPLY_PROPERTIES.map((p, i) => (
          <React.Fragment key={p.id}>
            {i > 0 ? ' · ' : null}
            <InlineLink href={p.harListingUrl} target="_blank" rel="noopener noreferrer">
              {p.addressLine}
            </InlineLink>
          </React.Fragment>
        ))}
        .
      </HarNote>
    </>
  );
};

export default RentalPropertyApplyTiles;
