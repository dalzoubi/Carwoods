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
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import HardBreak from '@tiptap/extension-hard-break';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import CodeIcon from '@mui/icons-material/Code';
import LinkIcon from '@mui/icons-material/Link';
import { useTranslation } from 'react-i18next';
import {
  editorHtmlToMarkdown,
  isAllowedMessageLinkHref,
  markdownToTipTapHtml,
} from '../../lib/portalMessageEditorBridge';

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
 * WYSIWYG message field (TipTap): stores the same markdown string as before for the API.
 * Formatting toolbar shows while the editor or toolbar has focus.
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
          bulletList: false,
          orderedList: false,
          heading: false,
          horizontalRule: false,
          codeBlock: false,
          strike: false,
          underline: false,
          hardBreak: false,
          link: false,
        }),
        HardBreak.extend({
          addKeyboardShortcuts() {
            return {
              Enter: () => this.editor.commands.setHardBreak(),
            };
          },
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
      ],
      content: markdownToTipTapHtml(value),
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
            <Tooltip title={t('portalRequests.messages.composeToolbarCode')} placement="top">
              <span>
                <IconButton
                  type="button"
                  size="small"
                  color={editor?.isActive('code') ? 'primary' : 'default'}
                  aria-label={t('portalRequests.messages.composeToolbarCode')}
                  aria-pressed={editor?.isActive('code') ?? false}
                  disabled={!canFmt}
                  onMouseDown={preventTakeFocusFromField}
                  onClick={() => editor?.chain().focus().toggleCode().run()}
                >
                  <CodeIcon fontSize="small" />
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
        <FormHelperText sx={{ mx: 0 }}>{t('portalRequests.messages.composeHelper')}</FormHelperText>
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
