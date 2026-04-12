import React from 'react';
import { Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { renderPortalMessageMarkdownToHtml } from './portalMessageEditorBridge';

/**
 * Renders a maintenance request message body from markdown (bold, italic, lists, links, line breaks).
 * Uses the same markdown-it rules as the compose editor (`html: false` in source).
 */
export function PortalMessageBody({ text, sx, ...typographyProps }) {
  const theme = useTheme();
  const html = React.useMemo(
    () => renderPortalMessageMarkdownToHtml(String(text ?? '')),
    [text]
  );

  return (
    <Typography
      component="div"
      variant="body2"
      sx={{
        width: '100%',
        maxWidth: '100%',
        wordBreak: 'break-word',
        '& p': { margin: 0 },
        '& p + p': { marginTop: theme.spacing(0.75) },
        '& ul, & ol': {
          margin: 0,
          marginTop: theme.spacing(0.5),
          paddingInlineStart: theme.spacing(3),
        },
        '& li': { marginTop: theme.spacing(0.25) },
        '& li p': { marginTop: theme.spacing(0.25) },
        '& a': {
          color: theme.palette.primary.main,
          fontWeight: 500,
          textDecoration: 'underline',
          textUnderlineOffset: 2,
          wordBreak: 'break-all',
        },
        '& code': {
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '0.925em',
          backgroundColor: theme.palette.action.hover,
          padding: '0 4px',
          borderRadius: 4,
        },
        ...sx,
      }}
      {...typographyProps}
      dangerouslySetInnerHTML={{ __html: html || '' }}
    />
  );
}
