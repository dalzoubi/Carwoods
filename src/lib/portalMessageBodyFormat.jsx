import React from 'react';
import { Link, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

function isSafeHref(href) {
  const u = String(href).trim().toLowerCase();
  if (!u) return false;
  return u.startsWith('https://') || u.startsWith('http://') || u.startsWith('mailto:');
}

/** Closing `)` for `[label](url)` when `url` may contain balanced parentheses (e.g. alert(1)). */
function findMarkdownLinkCloseParen(str, openParenIndex) {
  let depth = 0;
  for (let i = openParenIndex + 1; i < str.length; i += 1) {
    const c = str[i];
    if (c === '(') {
      depth += 1;
    } else if (c === ')') {
      if (depth === 0) return i;
      depth -= 1;
    }
  }
  return -1;
}

/**
 * Renders a small markdown-like subset as React nodes: **bold**, *italic*,
 * `inline code`, and [label](http|https|mailto URL). Unsafe link targets are shown as plain text.
 *
 * @param {string} str
 * @param {{ n: number }} keyRef
 * @param {import('@mui/material/styles').Theme | null} theme
 */
export function parsePortalMessageBodyToNodes(str, keyRef, theme) {
  if (!str) return [];
  const key = () => `pm-${keyRef.n++}`;
  /** @type {React.ReactNode[]} */
  const result = [];
  let pos = 0;

  while (pos < str.length) {
    const ch = str[pos];

    if (ch === '`') {
      const end = str.indexOf('`', pos + 1);
      if (end === -1) {
        result.push(str.slice(pos));
        break;
      }
      const inner = str.slice(pos + 1, end);
      result.push(
        <Typography
          component="span"
          key={key()}
          variant="inherit"
          sx={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            backgroundColor: theme ? alpha(theme.palette.text.primary, 0.12) : undefined,
            px: 0.5,
            borderRadius: 0.5,
            fontSize: '0.925em',
          }}
        >
          {inner}
        </Typography>
      );
      pos = end + 1;
      continue;
    }

    if (ch === '*' && str[pos + 1] === '*') {
      const end = str.indexOf('**', pos + 2);
      if (end === -1) {
        result.push('*');
        pos += 1;
        continue;
      }
      const inner = str.slice(pos + 2, end);
      result.push(
        <strong key={key()}>{parsePortalMessageBodyToNodes(inner, keyRef, theme)}</strong>
      );
      pos = end + 2;
      continue;
    }

    if (ch === '*') {
      const end = str.indexOf('*', pos + 1);
      if (end === -1 || end === pos + 1) {
        result.push('*');
        pos += 1;
        continue;
      }
      const inner = str.slice(pos + 1, end);
      result.push(<em key={key()}>{parsePortalMessageBodyToNodes(inner, keyRef, theme)}</em>);
      pos = end + 1;
      continue;
    }

    if (ch === '[') {
      const closeBracket = str.indexOf(']', pos + 1);
      if (closeBracket === -1) {
        result.push(ch);
        pos += 1;
        continue;
      }
      const openParen = closeBracket + 1;
      if (str[openParen] !== '(') {
        result.push(str.slice(pos, closeBracket + 1));
        pos = closeBracket + 1;
        continue;
      }
      const closeParen = findMarkdownLinkCloseParen(str, openParen);
      if (closeParen === -1) {
        result.push(str.slice(pos, closeBracket + 1));
        pos = closeBracket + 1;
        continue;
      }
      const label = str.slice(pos + 1, closeBracket);
      const href = str.slice(openParen + 1, closeParen);
      if (isSafeHref(href)) {
        result.push(
          <Link
            key={key()}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            color="inherit"
            sx={{ fontWeight: 500, wordBreak: 'break-all' }}
          >
            {parsePortalMessageBodyToNodes(label, keyRef, theme)}
          </Link>
        );
        pos = closeParen + 1;
        continue;
      }
      result.push(str.slice(pos, closeParen + 1));
      pos = closeParen + 1;
      continue;
    }

    let next = str.length;
    for (let i = pos + 1; i < str.length; i += 1) {
      const c = str[i];
      if (c === '`' || c === '[' || c === '*') {
        next = i;
        break;
      }
    }
    result.push(str.slice(pos, next));
    pos = next;
  }

  return result;
}

/**
 * Message thread body: lightweight inline formatting with plain newlines preserved.
 */
export function PortalMessageBody({ text, sx, ...typographyProps }) {
  const theme = useTheme();
  const nodes = React.useMemo(() => {
    const keyRef = { n: 0 };
    return parsePortalMessageBodyToNodes(String(text ?? ''), keyRef, theme);
  }, [text, theme]);

  return (
    <Typography
      component="div"
      variant="body2"
      sx={{
        width: '100%',
        maxWidth: '100%',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        ...sx,
      }}
      {...typographyProps}
    >
      {nodes}
    </Typography>
  );
}
