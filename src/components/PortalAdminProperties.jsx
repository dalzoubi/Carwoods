import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import Edit from '@mui/icons-material/Edit';
import Delete from '@mui/icons-material/Delete';
import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import Home from '@mui/icons-material/Home';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { normalizeRole, resolveRole } from '../portalUtils';
import {
  addProperty,
  deleteProperty,
  loadProperties,
  updateProperty,
} from '../portalPropertiesStorage';

const HAR_UA = 'Mozilla/5.0 (compatible; CarwoodsSite/1.0; +https://carwoods.com)';

function buildHarFetchUrl(harId) {
  return `https://www.har.com/homedetail/${encodeURIComponent(harId.trim())}`;
}

function findProductNode(graph) {
  if (!Array.isArray(graph)) return null;
  return graph.find(
    (n) =>
      Array.isArray(n['@type']) &&
      n['@type'].includes('Product') &&
      n['@type'].includes('SingleFamilyResidence')
  );
}

function extractProductFromHtml(html) {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1]);
      const product = findProductNode(json['@graph']);
      if (product) return product;
    } catch {
      /* skip */
    }
  }
  return null;
}

function findAdditional(product, name) {
  const list = product?.offers?.itemOffered?.additionalProperty;
  if (!Array.isArray(list)) return null;
  return list.find((x) => x?.name === name)?.value ?? null;
}

function formatUsdMonthly(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '';
  return `$${n.toLocaleString('en-US')}/mo`;
}

function formatBaths(total) {
  if (typeof total !== 'number' || Number.isNaN(total)) return null;
  const full = Math.floor(total);
  const frac = total - full;
  const halfCount = Math.round(frac * 2);
  if (halfCount === 0) return `${full} Full Bath(s)`;
  if (full === 0) return `${halfCount} Half Bath(s)`;
  return `${full} Full & ${halfCount} Half Bath(s)`;
}

function firstImageUrl(product) {
  const img = product?.image;
  if (typeof img === 'string') return img;
  if (Array.isArray(img) && img.length) return img[0];
  return '';
}

function extractApplyLink(html) {
  const m = html.match(/https:\/\/apply\.link\/[A-Za-z0-9_-]+/);
  return m ? m[0] : '';
}

function lotSqftFromSpeech(html) {
  const match = html.match(/lot size is ([\d,]+) Square feet/i);
  if (!match) return null;
  return Number.parseInt(match[1].replace(/,/g, ''), 10);
}

function parseHarProduct(harId, product, harListingUrl, html) {
  const addr = product.address ?? {};
  const street = addr.streetAddress ?? '';
  const city = addr.addressLocality ?? '';
  const region = addr.addressRegion ?? '';
  const zip = addr.postalCode ?? '';
  const cityStateZip = [city, region].filter(Boolean).join(', ') + (zip ? ` ${zip}` : '');

  const beds = product.numberOfBedrooms;
  const baths = product.numberOfBathroomsTotal;
  const livingSqft = product.floorSize?.value;

  const detailLines = [];
  if (typeof beds === 'number') detailLines.push(`${beds} Bedroom(s)`);
  const bathLine = formatBaths(baths);
  if (bathLine) detailLines.push(bathLine);
  if (typeof livingSqft === 'number' && !Number.isNaN(livingSqft)) {
    detailLines.push(`${livingSqft.toLocaleString('en-US')} Sqft`);
  }

  // Lot size
  const rawLot = findAdditional(product, 'Lot Size');
  if (rawLot) {
    const acresMatch = String(rawLot).match(/([\d.]+)\s*Acres?/i);
    if (acresMatch) {
      const acres = Number.parseFloat(acresMatch[1]);
      if (!Number.isNaN(acres)) {
        detailLines.push(`${Math.round(acres * 43560).toLocaleString('en-US')} Lot Sqft`);
      }
    }
  } else {
    const speechSqft = lotSqftFromSpeech(html);
    if (speechSqft != null) detailLines.push(`${speechSqft.toLocaleString('en-US')} Lot Sqft`);
  }

  const ptype = findAdditional(product, 'Property Type');
  if (ptype) detailLines.push(String(ptype));

  return {
    harId: String(harId),
    addressLine: street || (product.name ?? '').split(',')[0]?.trim() || '',
    cityStateZip: cityStateZip.trim(),
    monthlyRentLabel: formatUsdMonthly(product.offers?.price),
    photoUrl: firstImageUrl(product),
    harListingUrl,
    applyUrl: extractApplyLink(html),
    detailLines,
  };
}

const EMPTY_FORM = {
  harId: '',
  addressLine: '',
  cityStateZip: '',
  monthlyRentLabel: '',
  photoUrl: '',
  harListingUrl: '',
  applyUrl: '',
  detailLinesText: '',
  showOnApplyPage: true,
};

function propertyToForm(p) {
  return {
    harId: p.harId ?? '',
    addressLine: p.addressLine ?? '',
    cityStateZip: p.cityStateZip ?? '',
    monthlyRentLabel: p.monthlyRentLabel ?? '',
    photoUrl: p.photoUrl ?? '',
    harListingUrl: p.harListingUrl ?? '',
    applyUrl: p.applyUrl ?? '',
    detailLinesText: (p.detailLines ?? []).join('\n'),
    showOnApplyPage: Boolean(p.showOnApplyPage),
  };
}

function formToRecord(form) {
  return {
    harId: form.harId.trim(),
    addressLine: form.addressLine.trim(),
    cityStateZip: form.cityStateZip.trim(),
    monthlyRentLabel: form.monthlyRentLabel.trim(),
    photoUrl: form.photoUrl.trim(),
    harListingUrl: form.harListingUrl.trim(),
    applyUrl: form.applyUrl.trim(),
    detailLines: form.detailLinesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    showOnApplyPage: form.showOnApplyPage,
  };
}

function validate(form, t) {
  const errors = {};
  if (!form.addressLine.trim()) errors.addressLine = t('portalAdminProperties.errors.addressRequired');
  if (!form.cityStateZip.trim()) errors.cityStateZip = t('portalAdminProperties.errors.cityStateZipRequired');
  return errors;
}

const PropertyCard = ({ property, onEdit, onDelete, t }) => {
  const hasPhoto = Boolean(property.photoUrl);
  return (
    <Card variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 2 }}>
      {hasPhoto ? (
        <CardMedia
          component="img"
          image={property.photoUrl}
          alt={property.addressLine}
          sx={{ height: 160, objectFit: 'cover' }}
        />
      ) : (
        <Box
          sx={{
            height: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'action.hover',
          }}
        >
          <Home sx={{ fontSize: 48, color: 'text.disabled' }} />
        </Box>
      )}
      <CardContent sx={{ flex: 1, pb: 1 }}>
        <Stack spacing={0.5} sx={{ mb: 1 }}>
          <Typography variant="body1" fontWeight={700} noWrap>
            {property.addressLine || '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {property.cityStateZip || '—'}
          </Typography>
          {property.monthlyRentLabel && (
            <Typography variant="body2" fontWeight={600} color="primary.main">
              {property.monthlyRentLabel}
            </Typography>
          )}
          {property.harId && (
            <Typography variant="caption" color="text.disabled">
              {t('portalAdminProperties.grid.harId')}: {property.harId}
            </Typography>
          )}
        </Stack>
        <Chip
          label={t('portalAdminProperties.grid.showOnApply')}
          size="small"
          color={property.showOnApplyPage ? 'success' : 'default'}
          variant={property.showOnApplyPage ? 'filled' : 'outlined'}
          sx={{ mb: 1 }}
        />
      </CardContent>
      <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Tooltip title={t('portalAdminProperties.grid.editButton')}>
          <IconButton
            type="button"
            size="small"
            aria-label={t('portalAdminProperties.grid.editButton')}
            onClick={() => onEdit(property)}
          >
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('portalAdminProperties.grid.deleteButton')}>
          <IconButton
            type="button"
            size="small"
            color="error"
            aria-label={t('portalAdminProperties.grid.deleteButton')}
            onClick={() => onDelete(property)}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Card>
  );
};

const PortalAdminProperties = () => {
  const { t } = useTranslation();
  const { isAuthenticated, account, meData, meStatus } = usePortalAuth();

  const role = normalizeRole(resolveRole(meData, account));
  const canManage = isAuthenticated && (role === 'ADMIN' || role === 'LANDLORD');

  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [editingId, setEditingId] = useState(null);

  const [harSearchId, setHarSearchId] = useState('');
  const [harStatus, setHarStatus] = useState('idle'); // idle | searching | found | not_found | error
  const [harMessage, setHarMessage] = useState('');

  const [submitStatus, setSubmitStatus] = useState('idle');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileInputRef = useRef(null);

  const refresh = useCallback(() => {
    setProperties(loadProperties());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showSnack = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setEditingId(null);
    setHarSearchId('');
    setHarStatus('idle');
    setHarMessage('');
    setSubmitStatus('idle');
  };

  const handleEdit = (property) => {
    setForm(propertyToForm(property));
    setEditingId(property.id);
    setHarSearchId(property.harId ?? '');
    setHarStatus('idle');
    setHarMessage('');
    setFieldErrors({});
    setSubmitStatus('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = (property) => {
    setDeleteTarget(property);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteProperty(deleteTarget.id);
    refresh();
    setDeleteTarget(null);
    showSnack(t('portalAdminProperties.messages.deleted'), 'info');
  };

  const handleHarSearch = async () => {
    const id = harSearchId.trim();
    if (!id) return;
    setHarStatus('searching');
    setHarMessage('');
    try {
      const url = buildHarFetchUrl(id);
      const res = await fetch(url, {
        headers: { 'User-Agent': HAR_UA, Accept: 'text/html' },
        redirect: 'follow',
      });
      if (!res.ok) {
        setHarStatus('not_found');
        setHarMessage(t('portalAdminProperties.harSearch.notFound'));
        return;
      }
      const html = await res.text();
      const product = extractProductFromHtml(html);
      if (!product) {
        setHarStatus('not_found');
        setHarMessage(t('portalAdminProperties.harSearch.notFound'));
        return;
      }
      const parsed = parseHarProduct(id, product, res.url, html);
      setForm((prev) => ({
        ...prev,
        harId: parsed.harId,
        addressLine: parsed.addressLine || prev.addressLine,
        cityStateZip: parsed.cityStateZip || prev.cityStateZip,
        monthlyRentLabel: parsed.monthlyRentLabel || prev.monthlyRentLabel,
        photoUrl: parsed.photoUrl || prev.photoUrl,
        harListingUrl: parsed.harListingUrl || prev.harListingUrl,
        applyUrl: parsed.applyUrl || prev.applyUrl,
        detailLinesText: parsed.detailLines.length
          ? parsed.detailLines.join('\n')
          : prev.detailLinesText,
      }));
      setHarStatus('found');
      setHarMessage(t('portalAdminProperties.harSearch.found'));
    } catch {
      setHarStatus('error');
      setHarMessage(t('portalAdminProperties.harSearch.fetchError'));
    }
  };

  const handlePhotoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setForm((prev) => ({ ...prev, photoUrl: evt.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const onChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const errors = validate(form, t);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSubmitStatus('saving');
    const record = formToRecord(form);
    if (editingId) {
      updateProperty(editingId, record);
      showSnack(t('portalAdminProperties.messages.updated'));
    } else {
      addProperty(record);
      showSnack(t('portalAdminProperties.messages.added'));
    }
    refresh();
    resetForm();
    setSubmitStatus('idle');
  };

  return (
    <Box sx={{ py: 4 }}>
      <Helmet>
        <title>{t('portalAdminProperties.title')}</title>
        <meta name="description" content={t('portalAdminProperties.metaDescription')} />
      </Helmet>

      <Stack spacing={3}>
        <Box>
          <Typography variant="h5" component="h2" fontWeight={700} gutterBottom>
            {t('portalAdminProperties.heading')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('portalAdminProperties.intro')}
          </Typography>
        </Box>

        {!isAuthenticated && (
          <Alert severity="warning">{t('portalAdminProperties.errors.signInRequired')}</Alert>
        )}
        {isAuthenticated && meStatus !== 'loading' && !canManage && (
          <Alert severity="error">{t('portalAdminProperties.errors.landlordOrAdminOnly')}</Alert>
        )}

        {/* HAR Search Panel */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {t('portalAdminProperties.harSearch.heading')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
            <TextField
              label={t('portalAdminProperties.harSearch.harIdLabel')}
              helperText={t('portalAdminProperties.harSearch.harIdHelperText')}
              value={harSearchId}
              onChange={(e) => {
                setHarSearchId(e.target.value);
                setHarStatus('idle');
                setHarMessage('');
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleHarSearch(); } }}
              size="small"
              sx={{ minWidth: 220, flexShrink: 0 }}
              slotProps={{
                input: {
                  endAdornment: harStatus === 'searching' ? (
                    <InputAdornment position="end">
                      <CircularProgress size={18} />
                    </InputAdornment>
                  ) : null,
                },
              }}
            />
            <Button
              type="button"
              variant="contained"
              startIcon={<Search />}
              onClick={() => void handleHarSearch()}
              disabled={!harSearchId.trim() || harStatus === 'searching'}
              sx={{ mt: { xs: 0, sm: '4px' }, whiteSpace: 'nowrap' }}
            >
              {harStatus === 'searching'
                ? t('portalAdminProperties.harSearch.searching')
                : t('portalAdminProperties.harSearch.searchButton')}
            </Button>
          </Stack>
          {harMessage && (
            <Alert
              severity={harStatus === 'found' ? 'success' : 'warning'}
              sx={{ mt: 1.5 }}
            >
              {harMessage}
            </Alert>
          )}
        </Paper>

        {/* Property Form */}
        <Paper
          component="form"
          variant="outlined"
          onSubmit={onSubmit}
          sx={{ p: 3, borderRadius: 2 }}
        >
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={600}>
              {t('portalAdminProperties.form.heading')}
              {editingId && (
                <Chip
                  label={t('portalAdminProperties.grid.editButton')}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ ml: 1.5, verticalAlign: 'middle' }}
                />
              )}
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('portalAdminProperties.form.addressLine')}
                  value={form.addressLine}
                  onChange={onChange('addressLine')}
                  required
                  fullWidth
                  error={Boolean(fieldErrors.addressLine)}
                  helperText={fieldErrors.addressLine || ' '}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('portalAdminProperties.form.cityStateZip')}
                  value={form.cityStateZip}
                  onChange={onChange('cityStateZip')}
                  required
                  fullWidth
                  error={Boolean(fieldErrors.cityStateZip)}
                  helperText={fieldErrors.cityStateZip || ' '}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('portalAdminProperties.form.monthlyRent')}
                  value={form.monthlyRentLabel}
                  onChange={onChange('monthlyRentLabel')}
                  fullWidth
                  helperText=" "
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('portalAdminProperties.form.applyUrl')}
                  value={form.applyUrl}
                  onChange={onChange('applyUrl')}
                  fullWidth
                  type="url"
                  helperText=" "
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('portalAdminProperties.form.harListingUrl')}
                  value={form.harListingUrl}
                  onChange={onChange('harListingUrl')}
                  fullWidth
                  type="url"
                  helperText=" "
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('portalAdminProperties.form.detailLines')}
                  value={form.detailLinesText}
                  onChange={onChange('detailLinesText')}
                  fullWidth
                  multiline
                  minRows={3}
                  helperText=" "
                />
              </Grid>
            </Grid>

            {/* Photo Section */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('portalAdminProperties.form.photo')}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                <Stack spacing={1} sx={{ flexShrink: 0 }}>
                  <Button
                    type="button"
                    variant="outlined"
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {t('portalAdminProperties.form.photoUpload')}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handlePhotoFile}
                    tabIndex={-1}
                  />
                </Stack>
                <TextField
                  label={t('portalAdminProperties.form.photoUrlLabel')}
                  value={form.photoUrl}
                  onChange={onChange('photoUrl')}
                  size="small"
                  fullWidth
                  helperText=" "
                />
              </Stack>
              {form.photoUrl && (
                <Box sx={{ mt: 1.5, position: 'relative', display: 'inline-block' }}>
                  <Box
                    component="img"
                    src={form.photoUrl}
                    alt={t('portalAdminProperties.form.photoPreview')}
                    sx={{
                      height: 120,
                      maxWidth: 200,
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'block',
                    }}
                  />
                  <IconButton
                    type="button"
                    size="small"
                    aria-label={t('portalAdminProperties.form.cancel')}
                    onClick={() => setForm((prev) => ({ ...prev, photoUrl: '' }))}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      insetInlineEnd: 4,
                      backgroundColor: 'background.paper',
                      '&:hover': { backgroundColor: 'background.paper' },
                    }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={form.showOnApplyPage}
                  onChange={onChange('showOnApplyPage')}
                />
              }
              label={t('portalAdminProperties.form.showOnApplyPage')}
            />

            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
              <Button
                type="submit"
                variant="contained"
                disabled={!canManage || submitStatus === 'saving'}
                startIcon={editingId ? null : <Add />}
              >
                {editingId
                  ? t('portalAdminProperties.form.saveChanges')
                  : t('portalAdminProperties.form.addProperty')}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outlined"
                  onClick={resetForm}
                >
                  {t('portalAdminProperties.form.cancel')}
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>

        {/* Properties Grid */}
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {t('portalAdminProperties.grid.heading')}
          </Typography>

          {properties.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('portalAdminProperties.grid.empty')}
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {properties.map((property) => (
                <Grid item xs={12} sm={6} md={4} key={property.id}>
                  <PropertyCard
                    property={property}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    t={t}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </Stack>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        slotProps={{ paper: { sx: { backgroundImage: 'none' } } }}
      >
        <DialogTitle>{t('portalAdminProperties.grid.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('portalAdminProperties.grid.deleteConfirmBody', {
              address: deleteTarget?.addressLine ?? '',
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            type="button"
            onClick={() => setDeleteTarget(null)}
          >
            {t('portalAdminProperties.grid.deleteCancel')}
          </Button>
          <Button
            type="button"
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
          >
            {t('portalAdminProperties.grid.deleteConfirmAction')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PortalAdminProperties;
