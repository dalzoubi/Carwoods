import React from 'react';
import Link from '@mui/material/Link';

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when `value` is a non-empty string that looks like a normal email address (safe for mailto href). */
export function isDisplayableEmail(value) {
  return SIMPLE_EMAIL.test(String(value ?? '').trim());
}

/**
 * Renders a mailto link for a display email. Falls back to plain text when the address is missing or invalid.
 */
export default function MailtoEmailLink({
  email,
  children,
  stopPropagation = false,
  underline = 'hover',
  color = 'primary',
  sx,
  ...rest
}) {
  const addr = String(email ?? '').trim();
  if (!isDisplayableEmail(addr)) {
    const fallback = children !== undefined && children !== null ? children : addr;
    return <>{fallback}</>;
  }
  const handleClick = stopPropagation ? (e) => e.stopPropagation() : undefined;
  return (
    <Link
      href={`mailto:${addr}`}
      onClick={handleClick}
      underline={underline}
      color={color}
      sx={{ fontSize: 'inherit', ...sx }}
      {...rest}
    >
      {children ?? addr}
    </Link>
  );
}
