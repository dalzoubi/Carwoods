import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Description from '@mui/icons-material/Description';
import { useTranslation } from 'react-i18next';
import { VITE_API_BASE_URL_RESOLVED } from '../featureFlags';

function buildUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

const PublicDocumentShare = () => {
  const { token } = useParams();
  const { t } = useTranslation();
  const [passcode, setPasscode] = useState('');
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);

  const openShare = async () => {
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(
        buildUrl(VITE_API_BASE_URL_RESOLVED || '', `/api/public/document-shares/${encodeURIComponent(token || '')}`),
        {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          credentials: 'omit',
          body: JSON.stringify({ passcode, notice_accepted: noticeAccepted }),
        }
      );
      if (!res.ok) {
        let code = 'open_failed';
        try {
          const body = await res.json();
          code = body?.error || code;
        } catch {
          // best effort
        }
        throw new Error(code);
      }
      const data = await res.json();
      setPayload(data);
      setStatus('ok');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'open_failed');
      setStatus('error');
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', py: { xs: 2, md: 5 } }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 }, backgroundImage: 'none' }}>
        <Stack spacing={2.5} alignItems="flex-start">
          <Description color="primary" sx={{ fontSize: 42 }} />
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
              {t('publicDocumentShare.heading')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              {t('publicDocumentShare.body')}
            </Typography>
          </Box>

          {status === 'error' ? <Alert severity="error">{t(`publicDocumentShare.errors.${error}`, t('publicDocumentShare.errors.open_failed'))}</Alert> : null}

          {payload ? (
            <Alert severity="success" sx={{ width: '100%' }}>
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {payload.document?.title || payload.document?.original_filename || t('publicDocumentShare.documentReady')}
                </Typography>
                <Button type="button" variant="contained" href={payload.url} target="_blank" rel="noopener noreferrer">
                  {payload.document?.can_preview ? t('publicDocumentShare.openDocument') : t('publicDocumentShare.downloadDocument')}
                </Button>
              </Stack>
            </Alert>
          ) : (
            <>
              <TextField
                fullWidth
                label={t('publicDocumentShare.passcode')}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                helperText={t('publicDocumentShare.passcodeHelp')}
              />
              <FormControlLabel
                control={<Checkbox checked={noticeAccepted} onChange={(e) => setNoticeAccepted(e.target.checked)} />}
                label={t('publicDocumentShare.notice')}
              />
              <Button
                type="button"
                variant="contained"
                onClick={openShare}
                disabled={status === 'loading' || !noticeAccepted}
              >
                {status === 'loading' ? t('publicDocumentShare.opening') : t('publicDocumentShare.open')}
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

export default PublicDocumentShare;
