import React from 'react';
import { Avatar } from '@mui/material';
import { portalUserInitials, profilePhotoUrlFromMeData } from '../portalUtils';

/**
 * Circular avatar: profile photo when URL present, else initials.
 *
 * @param {object} props
 * @param {string} [props.photoUrl]  Explicit URL; overrides meData
 * @param {object} [props.meData]      Portal /me payload for profile_photo_url
 * @param {string} [props.firstName]
 * @param {string} [props.lastName]
 * @param {number} [props.size]
 * @param {object} [props.sx]
 */
export default function PortalUserAvatar({
  photoUrl: photoUrlProp,
  meData,
  firstName,
  lastName,
  size = 36,
  sx,
  ...rest
}) {
  const fromMe = profilePhotoUrlFromMeData(meData);
  const src = (typeof photoUrlProp === 'string' && photoUrlProp.trim())
    ? photoUrlProp.trim()
    : fromMe;
  const initials = portalUserInitials(firstName, lastName);

  return (
    <Avatar
      src={src || undefined}
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
      {initials}
    </Avatar>
  );
}
