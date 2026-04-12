import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormHelperText,
  FormLabel,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import LinkIcon from '@mui/icons-material/Link';
import { useTranslation } from 'react-i18next';
import {
  PORTAL_MESSAGE_BODY_MAX_CHARS,
  editorHtmlToMarkdown,
  isAllowedMessageLinkHref,
  markdownToTipTapHtml,
} from '../../lib/portalMessageEditorBridge';

function clampMarkdownToMax(md) {
  const s = String(md ?? '');
  if (s.length <= PORTAL_MESSAGE_BODY_MAX_CHARS) return s;
  return s.slice(0, PORTAL_MESSAGE_BODY_MAX_CHARS);
}

function preventTakeFocusFromField(event) {
  event.preventDefault();
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

function escapeText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * WYSIWYG message field (TipTap): markdown for the API, max {@link PORTAL_MESSAGE_BODY_MAX_CHARS} characters.
 */
export default function PortalRequestMessageCompose({
  value,
  onChange,
  disabled = false,
  label,
  required = false,
  minRows = 2,
  id: idProp,
}) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const lastEmittedRef = useRef(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  const [focusedWithin, setFocusedWithin] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkError, setLinkError] = useState('');
  const linkUrlInputRef = useRef(null);
  const fieldId = idProp ?? 'portal-request-message-body';
  const placeholder = t('portalRequests.messages.composePlaceholder');

  const showToolbar = focusedWithin && !disabled;
  const mdLength = String(value ?? '').length;
  const atLimit = mdLength >= PORTAL_MESSAGE_BODY_MAX_CHARS;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handleContainerBlur = (event) => {
    const next = event.relatedTarget;
    if (containerRef.current && next instanceof Node && containerRef.current.contains(next)) {
      return;
    }
    setFocusedWithin(false);
  };

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          blockquote: false,
          heading: false,
          horizontalRule: false,
          codeBlock: false,
          code: false,
          strike: false,
          underline: false,
          link: false,
        }),
        Link.configure({
          openOnClick: false,
          autolink: false,
          linkOnPaste: false,
          protocols: ['http', 'https', 'mailto'],
          defaultProtocol: 'https',
          HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank',
          },
          isAllowedUri: (url) => isAllowedMessageLinkHref(url),
        }),
        Placeholder.configure({ placeholder }),
        CharacterCount.configure({
          limit: PORTAL_MESSAGE_BODY_MAX_CHARS,
        }),
      ],
      content: markdownToTipTapHtml(clampMarkdownToMax(value)),
      editable: !disabled,
      shouldRerenderOnTransaction: true,
      editorProps: {
        attributes: {
          id: fieldId,
          'aria-multiline': 'true',
          role: 'textbox',
          'aria-label': typeof label === 'string' ? label : '',
          'aria-required': required ? 'true' : undefined,
        },
      },
      onUpdate: ({ editor: ed }) => {
        const md = editorHtmlToMarkdown(ed.getHTML());
        if (md.length > PORTAL_MESSAGE_BODY_MAX_CHARS) {
          const clipped = md.slice(0, PORTAL_MESSAGE_BODY_MAX_CHARS);
          lastEmittedRef.current = clipped;
          ed.commands.setContent(markdownToTipTapHtml(clipped), false);
          onChangeRef.current(clipped);
          return;
        }
        if (md === valueRef.current) {
          lastEmittedRef.current = md;
          return;
        }
        lastEmittedRef.current = md;
        onChangeRef.current(md);
      },
    },
    [placeholder, fieldId, label, required]
  );

  const openLinkDialogStable = useCallback(() => {
    setLinkError('');
    const href = editor?.getAttributes('link')?.href;
    setLinkUrl(typeof href === 'string' && href.trim() ? href.trim() : 'https://');
    setLinkDialogOpen(true);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const v = String(value ?? '');
    const clamped = clampMarkdownToMax(v);
    if (clamped !== v) {
      lastEmittedRef.current = clamped;
      onChangeRef.current(clamped);
      editor.commands.setContent(markdownToTipTapHtml(clamped), false);
      return;
    }
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    editor.commands.setContent(markdownToTipTapHtml(value), false);
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useLayoutEffect(() => {
    if (!linkDialogOpen) return;
    const id = requestAnimationFrame(() => {
      linkUrlInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [linkDialogOpen]);

  const applyLinkFromDialog = () => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!isAllowedMessageLinkHref(url)) {
      setLinkError(t('portalRequests.messages.composeLinkInvalidUrl'));
      return;
    }
    const chain = editor.chain().focus();
    if (editor.state.selection.empty) {
      const visible = url.replace(/^mailto:/i, '');
      chain
        .insertContent(`<a href="${escapeAttr(url)}">${escapeText(visible)}</a>`)
        .run();
    } else {
      chain.extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkDialogOpen(false);
  };

  const canFmt = Boolean(editor) && !disabled;

  return (
    <Box ref={containerRef} onBlur={handleContainerBlur}>
      <Collapse in={showToolbar} unmountOnExit>
        <Paper
          variant="outlined"
          sx={(theme) => ({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 0.25,
            px: 0.5,
            py: 0.25,
            mb: 0.75,
            borderRadius: 1,
            backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.55 : 0.95),
          })}
        >
          <Stack direction="row" spacing={0} useFlexGap flexWrap="wrap" alignItems="center">
            <Tooltip title={t('portalRequests.messages.composeToolbarBold')} placement="top">
              <span>
                <IconButton
                  type="button"
                  size="small"
                  color={editor?.isActive('bold') ? 'primary' : 'default'}
                  aria-label={t('portalRequests.messages.composeToolbarBold')}
                  aria-pressed={editor?.isActive('bold') ?? false}
                  disabled={!canFmt}
                  onMouseDown={preventTakeFocusFromField}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                >
                  <FormatBoldIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('portalRequests.messages.composeToolbarItalic')} placement="top">
              <span>
                <IconButton
                  type="button"
                  size="small"
                  color={editor?.isActive('italic') ? 'primary' : 'default'}
                  aria-label={t('portalRequests.messages.composeToolbarItalic')}
                  aria-pressed={editor?.isActive('italic') ?? false}
                  disabled={!canFmt}
                  onMouseDown={preventTakeFocusFromField}
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                >
                  <FormatItalicIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('portalRequests.messages.composeToolbarBulletList')} placement="top">
              <span>
                <IconButton
                  type="button"
                  size="small"
                  color={editor?.isActive('bulletList') ? 'primary' : 'default'}
                  aria-label={t('portalRequests.messages.composeToolbarBulletList')}
                  aria-pressed={editor?.isActive('bulletList') ?? false}
                  disabled={!canFmt}
                  onMouseDown={preventTakeFocusFromField}
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                >
                  <FormatListBulletedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('portalRequests.messages.composeToolbarOrderedList')} placement="top">
              <span>
                <IconButton
                  type="button"
                  size="small"
                  color={editor?.isActive('orderedList') ? 'primary' : 'default'}
                  aria-label={t('portalRequests.messages.composeToolbarOrderedList')}
                  aria-pressed={editor?.isActive('orderedList') ?? false}
                  disabled={!canFmt}
                  onMouseDown={preventTakeFocusFromField}
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                >
                  <FormatListNumberedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('portalRequests.messages.composeToolbarLink')} placement="top">
              <span>
                <IconButton
                  type="button"
                  size="small"
                  color={editor?.isActive('link') ? 'primary' : 'default'}
                  aria-label={t('portalRequests.messages.composeToolbarLink')}
                  aria-pressed={editor?.isActive('link') ?? false}
                  disabled={!canFmt}
                  onMouseDown={preventTakeFocusFromField}
                  onClick={openLinkDialogStable}
                >
                  <LinkIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Paper>
      </Collapse>

      <Stack spacing={0.75}>
        <FormLabel
          required={required}
          htmlFor={fieldId}
          sx={{ typography: 'body2', color: 'text.secondary' }}
        >
          {label}
        </FormLabel>
        <Box
          onFocus={() => setFocusedWithin(true)}
          sx={(theme) => ({
            border: '1px solid',
            borderColor: focusedWithin ? 'primary.main' : 'divider',
            borderRadius: 1,
            px: 1.5,
            py: 1,
            minHeight: theme.spacing(Math.max(2, minRows) * 2.75),
            backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.04) : theme.palette.background.paper,
            opacity: disabled ? 0.6 : 1,
            transition: theme.transitions.create(['border-color'], { duration: theme.transitions.duration.shorter }),
            '& .ProseMirror': {
              outline: 'none',
              minHeight: theme.spacing(Math.max(2, minRows) * 2.25),
              color: theme.palette.text.primary,
              typography: 'body1',
              '& p': { margin: 0 },
              '& p + p': { marginTop: theme.spacing(0.5) },
              '& ul, & ol': {
                margin: 0,
                paddingInlineStart: theme.spacing(3),
                marginTop: theme.spacing(0.5),
              },
              '& li': { marginTop: theme.spacing(0.25) },
              '& li p': { marginTop: 0 },
              '& a': {
                color: theme.palette.primary.main,
                textDecoration: 'underline',
                textUnderlineOffset: 2,
              },
            },
            '& .ProseMirror p.is-editor-empty:first-of-type::before': {
              color: theme.palette.text.disabled,
              content: 'attr(data-placeholder)',
              float: 'inline-start',
              height: 0,
              pointerEvents: 'none',
            },
          })}
        >
          {editor ? <EditorContent editor={editor} /> : null}
        </Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={0.5}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
          gap={0.5}
        >
          <FormHelperText component="span" sx={{ mx: 0, flex: 1 }}>
            {t('portalRequests.messages.composeHelper', { max: PORTAL_MESSAGE_BODY_MAX_CHARS })}
          </FormHelperText>
          <Typography
            component="span"
            variant="caption"
            color={atLimit ? 'error' : 'text.secondary'}
            sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'flex-start' } }}
            aria-live="polite"
          >
            {t('portalRequests.messages.composeCharacterCounter', {
              current: mdLength,
              max: PORTAL_MESSAGE_BODY_MAX_CHARS,
            })}
          </Typography>
        </Stack>
      </Stack>

      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('portalRequests.messages.composeLinkDialogTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            inputRef={linkUrlInputRef}
            margin="dense"
            label={t('portalRequests.messages.composeLinkUrlLabel')}
            value={linkUrl}
            onChange={(e) => {
              setLinkUrl(e.target.value);
              setLinkError('');
            }}
            fullWidth
            variant="standard"
            error={Boolean(linkError)}
            helperText={linkError || t('portalRequests.messages.composeLinkUrlHelper')}
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setLinkDialogOpen(false)}>
            {t('portalRequests.messages.composeLinkDialogCancel')}
          </Button>
          <Button type="button" variant="contained" onClick={applyLinkFromDialog}>
            {t('portalRequests.messages.composeLinkDialogApply')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
