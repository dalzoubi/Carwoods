import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { Avatar, Box } from '@mui/material';
import {
  portalUserInitials,
  profilePhotoUrlFromMeData,
  stableImageUrlIdentityKey,
} from '../portalUtils';

function uniquePhotoCandidates(primary, fallback) {
  const out = [];
  const seen = new Set();
  for (const raw of [primary, fallback]) {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function loadReducer(state, action) {
  if (action.type === 'reset') {
    return { attempt: 0, givenUp: false };
  }
  if (action.type === 'imgError') {
    const last = Math.max(0, action.candidateCount - 1);
    if (state.attempt < last) {
      return { ...state, attempt: state.attempt + 1 };
    }
    return { ...state, givenUp: true };
  }
  return state;
}

/**
 * Circular avatar: portal profile photo when URL present, else OAuth photo (Firebase),
 * else initials. Uses a plain img child so load failures can fall back and optionally
 * trigger /me refresh (fresh read SAS).
 *
 * @param {object} props
 * @param {string} [props.photoUrl]  Explicit URL; overrides meData profile URL
 * @param {object} [props.meData]      Portal /me payload for profile_photo_url
 * @param {string} [props.fallbackPhotoUrl]  e.g. Firebase user.photoURL
 * @param {() => void} [props.onProfilePhotoLoadError]  Invoked after all candidate URLs fail (e.g. refreshMe)
 * @param {string} [props.firstName]
 * @param {string} [props.lastName]
 * @param {number} [props.size]
 * @param {object} [props.sx]
 */
export default function PortalUserAvatar({
  photoUrl: photoUrlProp,
  meData,
  fallbackPhotoUrl,
  onProfilePhotoLoadError,
  firstName,
  lastName,
  size = 36,
  sx,
  ...rest
}) {
  const fromMe = profilePhotoUrlFromMeData(meData);
  const primary =
    typeof photoUrlProp === 'string' && photoUrlProp.trim()
      ? photoUrlProp.trim()
      : fromMe;
  const fallback =
    typeof fallbackPhotoUrl === 'string' && fallbackPhotoUrl.trim()
      ? fallbackPhotoUrl.trim()
      : '';

  const candidates = useMemo(
    () => uniquePhotoCandidates(primary, fallback),
    [primary, fallback]
  );
  const candidateKey = candidates.join('\0');
  const stableCandidateIdentityKey = useMemo(
    () => candidates.map((c) => stableImageUrlIdentityKey(c)).join('\0'),
    [candidates]
  );

  const [load, dispatch] = useReducer(loadReducer, { attempt: 0, givenUp: false });
  const refreshNotifiedRef = useRef(false);
  const prevStableIdentityRef = useRef('');

  // Reset load attempts whenever the full URL string changes (e.g. new SAS token).
  // Only clear refreshNotifiedRef when the underlying asset identity changes; if the
  // API returns a fresh signed URL for the same blob after refreshMe, re-clearing
  // would loop: fail → refreshMe → new SAS → reset ref → fail → refreshMe → …
  useEffect(() => {
    dispatch({ type: 'reset' });
    const prevStable = prevStableIdentityRef.current;
    const nextStable = stableCandidateIdentityKey;
    prevStableIdentityRef.current = nextStable;
    if (nextStable !== prevStable) {
      refreshNotifiedRef.current = false;
    }
  }, [candidateKey, stableCandidateIdentityKey]);

  useEffect(() => {
    if (load.givenUp && !refreshNotifiedRef.current) {
      refreshNotifiedRef.current = true;
      if (typeof onProfilePhotoLoadError === 'function') {
        onProfilePhotoLoadError();
      }
    }
  }, [load.givenUp, onProfilePhotoLoadError]);

  const activeSrc =
    !load.givenUp && candidates.length > 0
      ? candidates[Math.min(load.attempt, candidates.length - 1)]
      : '';

  const handleImgError = useCallback(() => {
    dispatch({ type: 'imgError', candidateCount: candidates.length });
  }, [candidates.length]);

  const initials = portalUserInitials(firstName, lastName);

  return (
    <Avatar
      alt=""
      sx={{
        width: size,
        height: size,
        bgcolor: 'primary.main',
        fontSize: size >= 80 ? '1.5rem' : size >= 48 ? '1.25rem' : '0.875rem',
        ...sx,
      }}
      {...rest}
    >
      {activeSrc ? (
        <Box
          component="img"
          src={activeSrc}
          alt=""
          onError={handleImgError}
          sx={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: 'cover',
          }}
        />
      ) : (
        initials
      )}
    </Avatar>
  );
}
