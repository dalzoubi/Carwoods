import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useTranslation } from 'react-i18next';

/**
 * Click-to-open help for admin configuration fields (mobile-friendly dialog, not hover tooltips).
 */
export default function PortalConfigOptionHelp({ labelKey, bodyKey, disabled }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        type="button"
        color="inherit"
        size="medium"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={t('portalAdminConfigurations.optionHelp.moreAbout', { option: t(labelKey) })}
        sx={{
          flexShrink: 0,
          width: 44,
          height: 44,
          color: 'text.secondary',
        }}
      >
        <InfoOutlinedIcon fontSize="small" aria-hidden />
      </IconButton>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        scroll="paper"
        aria-labelledby="portal-config-option-help-title"
      >
        <DialogTitle id="portal-config-option-help-title">{t(labelKey)}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-wrap' }}>
            {t(bodyKey)}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
          <Box sx={{ width: { xs: 1, sm: 'auto' } }}>
            <Button
              variant="contained"
              onClick={() => setOpen(false)}
              fullWidth
              sx={{ minHeight: 44 }}
            >
              {t('portalAdminConfigurations.optionHelp.close')}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** Full-width row: control + help icon (use for TextField, FormControl, etc.). */
export function ConfigFieldWithHelp({ labelKey, bodyKey, disabled, children }) {
  return (
    <Stack direction="row" alignItems="flex-start" spacing={0.25} sx={{ width: '100%' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      <PortalConfigOptionHelp labelKey={labelKey} bodyKey={bodyKey} disabled={disabled} />
    </Stack>
  );
}
