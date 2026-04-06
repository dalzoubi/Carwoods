import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import theme from '../theme';
import { VITE_API_BASE_URL_RESOLVED } from '../featureFlags';
import { fetchPublicApplyProperties } from '../publicApplyProperties';

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
    inset-inline-end: ${theme.spacing(1)};
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

const ListingsLoading = styled.div`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1.5)};
    margin-top: ${theme.spacing(2)};
    color: var(--palette-text-secondary);
    font-size: var(--typography-body1-font-size);
`;

const ListingsStatus = styled.p`
    margin: ${theme.spacing(2)} 0 0;
    color: var(--palette-text-secondary);
    font-size: var(--typography-body1-font-size);
`;

const ListingsAlert = styled.p`
    margin: ${theme.spacing(2)} 0 0;
    color: var(--palette-error-main);
    font-size: var(--typography-body1-font-size);
`;

function TileList({ tiles, t }) {
  return (
    <TileGrid>
      {tiles.map((p) => {
        const hasApplyUrl = Boolean(p.applyUrl);
        const applyLabel = t('apply.applyPhotoAria', { addressLine: p.addressLine });
        const detailsLabel = t('apply.fullListingDetailsAria', { addressLine: p.addressLine });
        const photoBlock = (
          <>
            <Photo src={p.photoUrl} alt="" loading="lazy" decoding="async" />
            <RentBadge>{p.monthlyRentLabel}</RentBadge>
          </>
        );
        return (
          <TileCard key={p.id}>
            {hasApplyUrl ? (
              <PhotoLink
                href={p.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={applyLabel}
              >
                {photoBlock}
              </PhotoLink>
            ) : (
              <PhotoLink
                as="div"
                role="img"
                aria-label={p.addressLine}
              >
                {photoBlock}
              </PhotoLink>
            )}
            <TileBody>
              <AddressBlock>
                <AddressMapLink
                  href={mapsSearchUrl(p.addressLine, p.cityStateZip)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('apply.openMapAria', {
                    addressLine: p.addressLine,
                    cityStateZip: p.cityStateZip,
                  })}
                >
                  <Street>{p.addressLine}</Street>
                  <CityZip>{p.cityStateZip}</CityZip>
                </AddressMapLink>
              </AddressBlock>
              <DetailList>
                {p.detailLines.map((line, idx) => (
                  <li key={`${idx}-${line}`}>{line}</li>
                ))}
              </DetailList>
              <ApplyBlock>
                {hasApplyUrl && (
                  <TextLink href={p.applyUrl} target="_blank" rel="noopener noreferrer">
                    {t('apply.applyNow')}
                  </TextLink>
                )}
                <TextLink
                  href={p.harListingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={detailsLabel}
                >
                  {t('apply.fullPropertyDetails')}
                </TextLink>
              </ApplyBlock>
            </TileBody>
          </TileCard>
        );
      })}
    </TileGrid>
  );
}

const RentalPropertyApplyTiles = () => {
  const { t } = useTranslation();
  const [tiles, setTiles] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiTiles = await fetchPublicApplyProperties(VITE_API_BASE_URL_RESOLVED);
        if (cancelled) return;
        setTiles(apiTiles);
      } catch {
        if (cancelled) return;
        setLoadError(true);
        setTiles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (tiles === null) {
    return (
      <ListingsLoading role="status" aria-live="polite">
        <CircularProgress size={36} aria-hidden />
        <span>{t('apply.listingsLoading')}</span>
      </ListingsLoading>
    );
  }

  if (tiles.length === 0) {
    if (loadError) {
      return <ListingsAlert role="alert">{t('apply.listingsUnavailable')}</ListingsAlert>;
    }
    return <ListingsStatus role="status">{t('apply.listingsEmpty')}</ListingsStatus>;
  }

  return <TileList tiles={tiles} t={t} />;
};

export default RentalPropertyApplyTiles;
