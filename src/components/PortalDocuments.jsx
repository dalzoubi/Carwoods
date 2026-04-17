import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import Description from '@mui/icons-material/Description';
import ContentCopy from '@mui/icons-material/ContentCopy';
import UploadFile from '@mui/icons-material/UploadFile';
import Search from '@mui/icons-material/Search';
import Delete from '@mui/icons-material/Delete';
import DeleteForever from '@mui/icons-material/DeleteForever';
import FilterAltOff from '@mui/icons-material/FilterAltOff';
import LinkOff from '@mui/icons-material/LinkOff';
import Restore from '@mui/icons-material/Restore';
import Share from '@mui/icons-material/Share';
import Download from '@mui/icons-material/Download';
import Visibility from '@mui/icons-material/Visibility';
import Lock from '@mui/icons-material/Lock';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { Role } from '../domain/constants.js';
import { normalizeRole, resolveRole } from '../portalUtils';
import { withDarkPath } from '../routePaths';
import { allowsDocumentCenter, landlordTierLimits } from '../portalTierUtils';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';
import PortalConfirmDialog from './PortalConfirmDialog';
import PortalRefreshButton from './PortalRefreshButton';
import EmptyState from './EmptyState';
import {
  createDocumentShareLink,
  deleteDocument,
  purgePortalDocument,
  fetchDocumentFileUrl,
  fetchDocumentShareLinks,
  fetchDocuments,
  fetchLandlordProperties,
  fetchRequestLookups,
  fetchTenants,
  finalizeDocumentUpload,
  putBlobToStorage,
  requestDocumentUploadIntent,
  revokeDocumentShareLink,
  restoreDocument,
  patchPortalDocument,
} from '../lib/portalApiClient';

const DOC_TYPES = [
  'LEASE',
  'RENTERS_INSURANCE',
  'NOTICE',
  'HOA_COMPLIANCE',
  'REPAIR_RECEIPT',
  'PROPERTY_INFORMATION',
  'TENANT_SUPPORTING_DOCUMENT',
  'OTHER',
];

const INITIAL_UPLOAD = {
  uploadPropertyId: '',
  uploadTenantUserId: '',
  uploadLeaseId: '',
  documentType: 'OTHER',
  title: '',
  note: '',
  shareWithTenants: false,
  sensitiveAcknowledged: false,
  file: null,
};

const UPLOAD_ALLOWED_EXT = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'gif']);
const UPLOAD_ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function isAllowedDocumentUploadFile(file) {
  if (!file?.name) return false;
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot + 1).trim().toLowerCase() : '';
  if (UPLOAD_ALLOWED_EXT.has(ext)) return true;
  const ct = String(file.type || '').toLowerCase();
  return Boolean(ct) && UPLOAD_ALLOWED_MIME.has(ct);
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function displayName(doc) {
  return doc.title || doc.original_filename || 'Document';
}

function scanChipColor(status) {
  if (status === 'CLEAN') return 'success';
  if (status === 'BLOCKED' || status === 'FAILED') return 'error';
  return 'warning';
}

function documentTypeLabel(t, type) {
  return t(`portalDocuments.types.${type}`, type);
}

function absoluteShareUrl(share) {
  const raw = share?.url || share?.path || '';
  if (!raw) return '';
  try {
    const origin = window.location?.origin || 'https://carwoods.com';
    return new URL(raw, origin).toString();
  } catch {
    return raw;
  }
}

function normFilterId(id) {
  return String(id ?? '').trim().toLowerCase();
}

/** Comma-separated tenant user ids from request-lookups lease row (lowercase UUIDs). */
function parseTenantUserIdsFromLease(lease) {
  const raw = lease?.tenant_user_ids;
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Lease row from management_create_lease_options (includes lease_start_date when API returns it). */
function formatLeaseDateRangeOnly(lease, t) {
  const start = lease.lease_start_date || '—';
  const m2mTag = t('portalDocuments.leaseRangeMonthToMonth');
  if (lease.month_to_month) {
    if (lease.lease_end_date) {
      return `${start} – ${lease.lease_end_date} ${m2mTag}`;
    }
    return `${start} – ${m2mTag}`;
  }
  return `${start} – ${lease.lease_end_date || '—'}`;
}

/** Upload / full context: address + date range. */
function formatManagementLeaseMenuLabel(lease, t) {
  const range = formatLeaseDateRangeOnly(lease, t);
  const addr = lease.property_address || '';
  return addr ? `${addr} · ${range}` : range;
}

function isPreviewable(doc) {
  return Boolean(doc?.can_preview);
}

/** Matches portal list toolbars (e.g. requests, contact requests): no forced caps on buttons. */
const portalBtnSx = { textTransform: 'none' };

/** Icon-only controls: no outline border, fixed box for alignment (toolbar + clear filters). */
const portalToolbarIconBtnSx = {
  width: 40,
  height: 40,
  padding: 0,
  border: 'none',
  borderRadius: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  '& .MuiSvgIcon-root': { fontSize: '1.25rem' },
};

const PortalDocuments = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { pathname } = useLocation();
  const { baseUrl, account, meData, getAccessToken, handleApiForbidden } = usePortalAuth();
  const role = normalizeRole(resolveRole(meData, account));
  const isTenant = role === Role.TENANT;
  const isLandlord = role === Role.LANDLORD;
  const tierAllows = allowsDocumentCenter(landlordTierLimits(meData));
  const showLocked = isLandlord && !tierAllows;

  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [eligibleLeases, setEligibleLeases] = useState([]);
  const [leaseOptions, setLeaseOptions] = useState([]);
  const [propertyOptions, setPropertyOptions] = useState([]);
  const [tenantDirectory, setTenantDirectory] = useState([]);
  const [query, setQuery] = useState('');
  const [docListView, setDocListView] = useState('active');
  const [filterPropertyId, setFilterPropertyId] = useState('');
  const [filterLeaseId, setFilterLeaseId] = useState('');
  const [filterTenantUserId, setFilterTenantUserId] = useState('');
  const [filterDocumentType, setFilterDocumentType] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upload, setUpload] = useState(INITIAL_UPLOAD);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState({ open: false, doc: null, url: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmPurge, setConfirmPurge] = useState(null);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [confirmTenantVisibility, setConfirmTenantVisibility] = useState(null);
  const [tenantVisibilityConfirmLoading, setTenantVisibilityConfirmLoading] = useState(false);
  const [shareDoc, setShareDoc] = useState(null);
  const [shareOptions, setShareOptions] = useState({ expiresInDays: 7, requirePasscode: false });
  const [shareResult, setShareResult] = useState(null);
  const [shareLinks, setShareLinks] = useState([]);
  const [shareLinksLoading, setShareLinksLoading] = useState(false);
  const [revokingLinkId, setRevokingLinkId] = useState('');
  const [sharingUpdatingId, setSharingUpdatingId] = useState('');
  const [uploadDragDepth, setUploadDragDepth] = useState(0);

  const emailHint = account?.username || undefined;

  const documentSharedWithTenants = (doc) => doc.share_with_tenants === true
    || String(doc.visibility ?? '').toUpperCase() === 'SHARED_WITH_TENANTS';

  const loadDocuments = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent);
    if (!baseUrl || showLocked || (isTenant && role !== Role.TENANT)) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const token = await getAccessToken();
      const payload = await fetchDocuments(baseUrl, token, {
        emailHint,
        q: query,
        ...(!isTenant ? { list: docListView } : {}),
        ...(filterPropertyId ? { property_id: filterPropertyId } : {}),
        ...(filterLeaseId ? { lease_id: filterLeaseId } : {}),
        ...(!isTenant && filterTenantUserId ? { tenant_user_id: filterTenantUserId } : {}),
        ...(filterDocumentType ? { document_type: filterDocumentType } : {}),
      });
      setDocuments(Array.isArray(payload.documents) ? payload.documents : []);
      setEligibleLeases(Array.isArray(payload.eligible_leases) ? payload.eligible_leases : []);
    } catch (error) {
      handleApiForbidden(error);
      showFeedback(t('portalDocuments.errors.loadFailed'), 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [
    baseUrl,
    docListView,
    emailHint,
    filterDocumentType,
    filterLeaseId,
    filterPropertyId,
    filterTenantUserId,
    getAccessToken,
    handleApiForbidden,
    isTenant,
    query,
    role,
    showFeedback,
    showLocked,
    t,
  ]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDocuments({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadDocuments]);

  const loadLookups = useCallback(async () => {
    if (!baseUrl || showLocked || isTenant) return;
    try {
      const token = await getAccessToken();
      const [lookups, propertiesPayload, tenantsPayload] = await Promise.all([
        fetchRequestLookups(baseUrl, token, { emailHint }),
        fetchLandlordProperties(baseUrl, token, { emailHint }),
        fetchTenants(baseUrl, token, { emailHint }),
      ]);
      setLeaseOptions(Array.isArray(lookups.management_create_lease_options)
        ? lookups.management_create_lease_options
        : []);
      setPropertyOptions(Array.isArray(propertiesPayload.properties)
        ? propertiesPayload.properties
        : []);
      setTenantDirectory(Array.isArray(tenantsPayload?.tenants) ? tenantsPayload.tenants : []);
    } catch (error) {
      handleApiForbidden(error);
    }
  }, [baseUrl, emailHint, getAccessToken, handleApiForbidden, isTenant, showLocked]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  const loadShareLinks = useCallback(async (docId) => {
    if (!baseUrl || !docId || !isLandlord) return;
    setShareLinksLoading(true);
    try {
      const token = await getAccessToken();
      const payload = await fetchDocumentShareLinks(baseUrl, token, docId, { emailHint });
      setShareLinks(Array.isArray(payload.links) ? payload.links : []);
    } catch (error) {
      handleApiForbidden(error);
      showFeedback(t('portalDocuments.errors.shareLinksFailed'), 'error');
    } finally {
      setShareLinksLoading(false);
    }
  }, [baseUrl, emailHint, getAccessToken, handleApiForbidden, isLandlord, showFeedback, t]);

  useEffect(() => {
    if (!shareDoc) {
      setShareLinks([]);
      return;
    }
    void loadShareLinks(shareDoc.id);
  }, [loadShareLinks, shareDoc]);

  const activeLeaseOptions = useMemo(() => (
    isTenant ? eligibleLeases.filter((l) => !l.readonly_access) : leaseOptions
  ), [eligibleLeases, isTenant, leaseOptions]);

  const managementLeasesByProperty = useMemo(() => {
    if (!filterPropertyId) return leaseOptions;
    return leaseOptions.filter((l) => String(l.property_id) === String(filterPropertyId));
  }, [leaseOptions, filterPropertyId]);

  const managementTenantsForFilter = useMemo(() => {
    const labelById = new Map();
    for (const row of tenantDirectory) {
      if (!row?.id) continue;
      const id = normFilterId(row.id);
      if (!labelById.has(id)) {
        const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
        labelById.set(id, name || row.email || row.id);
      }
    }
    const ids = new Set();
    for (const lease of managementLeasesByProperty) {
      parseTenantUserIdsFromLease(lease).forEach((id) => ids.add(id));
    }
    if (ids.size === 0) {
      if (filterPropertyId) {
        for (const row of tenantDirectory) {
          if (row?.id && String(row.property_id) === String(filterPropertyId)) {
            ids.add(normFilterId(row.id));
          }
        }
      } else {
        for (const row of tenantDirectory) {
          if (row?.id) ids.add(normFilterId(row.id));
        }
      }
    }
    return [...ids]
      .map((id) => ({ id, label: labelById.get(id) || id }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [filterPropertyId, managementLeasesByProperty, tenantDirectory]);

  const managementLeasesForFilter = useMemo(() => {
    let list = managementLeasesByProperty;
    if (filterTenantUserId) {
      const tid = normFilterId(filterTenantUserId);
      list = list.filter((lease) => parseTenantUserIdsFromLease(lease).includes(tid));
    }
    return list;
  }, [managementLeasesByProperty, filterTenantUserId]);

  const uploadLeasesByProperty = useMemo(() => {
    if (!upload.uploadPropertyId) return [];
    return leaseOptions.filter((l) => String(l.property_id) === String(upload.uploadPropertyId));
  }, [leaseOptions, upload.uploadPropertyId]);

  const uploadTenantsForSelect = useMemo(() => {
    if (!upload.uploadPropertyId) return [];
    const labelById = new Map();
    for (const row of tenantDirectory) {
      if (!row?.id) continue;
      const id = normFilterId(row.id);
      if (!labelById.has(id)) {
        const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
        labelById.set(id, name || row.email || row.id);
      }
    }
    const ids = new Set();
    for (const lease of uploadLeasesByProperty) {
      parseTenantUserIdsFromLease(lease).forEach((id) => ids.add(id));
    }
    if (ids.size === 0) {
      for (const row of tenantDirectory) {
        if (row?.id && String(row.property_id) === String(upload.uploadPropertyId)) {
          ids.add(normFilterId(row.id));
        }
      }
    }
    return [...ids]
      .map((id) => ({ id, label: labelById.get(id) || id }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [tenantDirectory, upload.uploadPropertyId, uploadLeasesByProperty]);

  const uploadLeasesForSelect = useMemo(() => {
    if (!upload.uploadTenantUserId) return [];
    const tid = normFilterId(upload.uploadTenantUserId);
    return uploadLeasesByProperty.filter((lease) => parseTenantUserIdsFromLease(lease).includes(tid));
  }, [uploadLeasesByProperty, upload.uploadTenantUserId]);

  useEffect(() => {
    if (!upload.uploadLeaseId || isTenant) return;
    if (!uploadLeasesForSelect.some((l) => String(l.lease_id) === String(upload.uploadLeaseId))) {
      setUpload((prev) => ({ ...prev, uploadLeaseId: '' }));
    }
  }, [isTenant, upload.uploadLeaseId, uploadLeasesForSelect]);

  useEffect(() => {
    if (!upload.uploadTenantUserId || isTenant) return;
    const ok = uploadTenantsForSelect.some((row) => normFilterId(row.id) === normFilterId(upload.uploadTenantUserId));
    if (!ok) {
      setUpload((prev) => ({ ...prev, uploadTenantUserId: '', uploadLeaseId: '' }));
    }
  }, [isTenant, upload.uploadTenantUserId, uploadTenantsForSelect]);

  useEffect(() => {
    if (isTenant || upload.uploadTenantUserId || !upload.uploadLeaseId) return;
    setUpload((prev) => ({ ...prev, uploadLeaseId: '' }));
  }, [isTenant, upload.uploadTenantUserId, upload.uploadLeaseId]);

  const tenantPropertyChoices = useMemo(() => {
    const m = new Map();
    for (const l of eligibleLeases) {
      if (l.property_id && !m.has(l.property_id)) {
        m.set(l.property_id, { id: l.property_id, label: l.property_label || l.property_id });
      }
    }
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [eligibleLeases]);

  const tenantLeasesForFilter = useMemo(() => {
    if (!filterPropertyId) return eligibleLeases;
    return eligibleLeases.filter((l) => String(l.property_id) === String(filterPropertyId));
  }, [eligibleLeases, filterPropertyId]);

  useEffect(() => {
    if (!filterLeaseId) return;
    const pool = isTenant ? tenantLeasesForFilter : managementLeasesForFilter;
    if (!pool.some((l) => String(l.lease_id) === String(filterLeaseId))) {
      setFilterLeaseId('');
    }
  }, [filterLeaseId, filterPropertyId, isTenant, managementLeasesForFilter, tenantLeasesForFilter]);

  useEffect(() => {
    if (!filterTenantUserId || isTenant) return;
    const ok = managementTenantsForFilter.some((row) => normFilterId(row.id) === normFilterId(filterTenantUserId));
    if (!ok) {
      setFilterTenantUserId('');
      setFilterLeaseId('');
    }
  }, [filterTenantUserId, isTenant, managementTenantsForFilter]);

  /** Management: lease filter requires a tenant; clear stale lease when tenant cleared. */
  useEffect(() => {
    if (isTenant || filterTenantUserId || !filterLeaseId) return;
    setFilterLeaseId('');
  }, [isTenant, filterTenantUserId, filterLeaseId]);

  const clearDocFilters = useCallback(() => {
    setFilterPropertyId('');
    setFilterLeaseId('');
    setFilterTenantUserId('');
    setFilterDocumentType('');
  }, []);

  const resetUpload = () => {
    setUpload(INITIAL_UPLOAD);
    setUploadProgress(0);
    setUploadDragDepth(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** @param {{ applyDocFilters?: boolean }} [opts] */
  const openUpload = useCallback((opts) => {
    setUploadProgress(0);
    setUploadDragDepth(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const base = { ...INITIAL_UPLOAD };
    if (opts && opts.applyDocFilters) {
      const dt = filterDocumentType?.trim() || '';
      if (dt && DOC_TYPES.includes(dt)) {
        base.documentType = dt;
      }
      if (!isTenant) {
        base.uploadPropertyId = filterPropertyId?.trim() || '';
        base.uploadTenantUserId = filterTenantUserId?.trim() || '';
        base.uploadLeaseId = filterLeaseId?.trim() || '';
        if (base.uploadLeaseId && !base.uploadPropertyId) {
          const row = leaseOptions.find((l) => String(l.lease_id) === String(base.uploadLeaseId));
          if (row?.property_id) base.uploadPropertyId = String(row.property_id);
        }
      } else {
        base.uploadLeaseId = filterLeaseId?.trim() || '';
      }
    }
    setUpload(base);
    setUploadOpen(true);
  }, [
    filterDocumentType,
    filterLeaseId,
    filterPropertyId,
    filterTenantUserId,
    isTenant,
    leaseOptions,
  ]);

  const closeUpload = () => {
    if (uploading) return;
    setUploadDragDepth(0);
    setUploadOpen(false);
  };

  const handleUploadDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    setUploadDragDepth((d) => d + 1);
  }, [uploading]);

  const handleUploadDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    setUploadDragDepth((d) => Math.max(0, d - 1));
  }, [uploading]);

  const handleUploadDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleUploadDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadDragDepth(0);
    if (uploading) return;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!isAllowedDocumentUploadFile(file)) {
      showFeedback(t('portalDocuments.errors.dropFileType'), 'error');
      return;
    }
    setUpload((prev) => ({ ...prev, file }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploading, showFeedback, t]);

  const handleUpload = async () => {
    if (!upload.file) {
      showFeedback(t('portalDocuments.errors.fileRequired'), 'error');
      return;
    }
    if (!upload.sensitiveAcknowledged) {
      showFeedback(t('portalDocuments.errors.ackRequired'), 'error');
      return;
    }
    if (isTenant && !upload.uploadLeaseId) {
      showFeedback(t('portalDocuments.errors.leaseRequired'), 'error');
      return;
    }
    if (!isTenant) {
      if (!String(upload.uploadPropertyId || '').trim()) {
        showFeedback(t('portalDocuments.errors.propertyRequired'), 'error');
        return;
      }
      if (upload.uploadTenantUserId && !upload.uploadLeaseId) {
        showFeedback(t('portalDocuments.errors.leaseRequiredWhenTenant'), 'error');
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const token = await getAccessToken();
      let scope_type;
      let lease_id;
      let property_id;
      let subject_tenant_user_id;
      if (isTenant) {
        scope_type = 'LEASE';
        lease_id = upload.uploadLeaseId;
        property_id = undefined;
        subject_tenant_user_id = undefined;
      } else if (upload.uploadLeaseId) {
        const leaseRow = leaseOptions.find((l) => String(l.lease_id) === String(upload.uploadLeaseId));
        const tid = upload.uploadTenantUserId?.trim();
        const useTenantScope = Boolean(tid)
          && leaseRow
          && parseTenantUserIdsFromLease(leaseRow).includes(normFilterId(tid));
        scope_type = useTenantScope ? 'TENANT_ON_LEASE' : 'LEASE';
        lease_id = upload.uploadLeaseId;
        property_id = undefined;
        subject_tenant_user_id = useTenantScope ? tid : undefined;
      } else {
        scope_type = 'PROPERTY';
        lease_id = undefined;
        property_id = upload.uploadPropertyId;
        subject_tenant_user_id = undefined;
      }
      const intentPayload = await requestDocumentUploadIntent(baseUrl, token, {
        emailHint,
        filename: upload.file.name,
        content_type: upload.file.type || 'application/octet-stream',
        file_size_bytes: upload.file.size,
        scope_type,
        lease_id,
        property_id,
        subject_tenant_user_id,
        document_type: upload.documentType,
        title: upload.title,
        note: upload.note,
        share_with_tenants: !isTenant && upload.shareWithTenants,
        sensitive_acknowledged: upload.sensitiveAcknowledged,
      });
      await putBlobToStorage(intentPayload.upload.upload_url, upload.file, setUploadProgress);
      await finalizeDocumentUpload(baseUrl, token, {
        emailHint,
        upload_intent_id: intentPayload.upload.upload_intent_id,
      });
      showFeedback(t('portalDocuments.messages.uploaded'), 'success');
      setUploadOpen(false);
      resetUpload();
      await loadDocuments();
    } catch (error) {
      handleApiForbidden(error);
      showFeedback(t('portalDocuments.errors.uploadFailed'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const openFile = async (doc, disposition = 'preview') => {
    try {
      const token = await getAccessToken();
      const payload = await fetchDocumentFileUrl(baseUrl, token, doc.id, { emailHint, disposition });
      if (disposition === 'download' || !payload.preview) {
        window.open(payload.url, '_blank', 'noopener,noreferrer');
        return;
      }
      setPreview({ open: true, doc, url: payload.url });
    } catch (error) {
      handleApiForbidden(error);
      showFeedback(t('portalDocuments.errors.openFailed'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const token = await getAccessToken();
      await deleteDocument(baseUrl, token, confirmDelete.id, { emailHint });
      showFeedback(t('portalDocuments.messages.deleted'), 'success');
      setConfirmDelete(null);
      await loadDocuments();
    } catch (error) {
      handleApiForbidden(error);
      showFeedback(t('portalDocuments.errors.deleteFailed'), 'error');
    }
  };

  const handleRestore = async (doc) => {
    try {
      const token = await getAccessToken();
      await restoreDocument(baseUrl, token, doc.id, { emailHint });
      showFeedback(t('portalDocuments.messages.restored'), 'success');
      await loadDocuments();
    } catch (error) {
      handleApiForbidden(error);
      showFeedback(t('portalDocuments.errors.restoreFailed'), 'error');
    }
  };

  const handlePurgePermanent = async () => {
    if (!confirmPurge) return;
    setPurgeLoading(true);
    try {
      const token = await getAccessToken();
      await purgePortalDocument(baseUrl, token, confirmPurge.id, { emailHint });
      showFeedback(t('portalDocuments.messages.purged'), 'success');
      setConfirmPurge(null);
      await loadDocuments();
    } catch (error) {
      handleApiForbidden(error);
      showFeedback(t('portalDocuments.errors.purgeFailed'), 'error');
    } finally {
      setPurgeLoading(false);
    }
  };

  const handleTenantSharingChange = async (doc, nextShared) => {
    setSharingUpdatingId(doc.id);
    try {
      const token = await getAccessToken();
      const payload = await patchPortalDocument(baseUrl, token, doc.id, {
        emailHint,
        share_with_tenants: nextShared,
      });
      const updated = payload?.document;
      if (updated?.id) {
        setDocuments((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      }
      showFeedback(t('portalDocuments.messages.sharingUpdated'), 'success');
    } catch (error) {
      handleApiForbidden(error);
      showFeedback(t('portalDocuments.errors.sharingUpdateFailed'), 'error');
    } finally {
      setSharingUpdatingId('');
    }
  };

  const handleConfirmTenantVisibility = async () => {
    const doc = confirmTenantVisibility?.doc;
    if (!doc) return;
    setTenantVisibilityConfirmLoading(true);
    try {
      await handleTenantSharingChange(doc, true);
    } finally {
      setTenantVisibilityConfirmLoading(false);
      setConfirmTenantVisibility(null);
    }
  };

  const handleShare = async () => {
    if (!shareDoc) return;
    try {
      const token = await getAccessToken();
      const payload = await createDocumentShareLink(baseUrl, token, shareDoc.id, {
        emailHint,
        expires_in_days: shareOptions.expiresInDays,
        require_passcode: shareOptions.requirePasscode,
      });
      setShareResult(payload.share);
      await loadShareLinks(shareDoc.id);
      showFeedback(t('portalDocuments.messages.shareCreated'), 'success');
    } catch (error) {
      handleApiForbidden(error);
      showFeedback(t('portalDocuments.errors.shareFailed'), 'error');
    }
  };

  const handleRevokeShareLink = async (linkId) => {
    if (!shareDoc || !linkId) return;
    setRevokingLinkId(linkId);
    try {
      const token = await getAccessToken();
      await revokeDocumentShareLink(baseUrl, token, linkId, { emailHint });
      showFeedback(t('portalDocuments.messages.shareRevoked'), 'success');
      await loadShareLinks(shareDoc.id);
    } catch (error) {
      handleApiForbidden(error);
      showFeedback(t('portalDocuments.errors.shareRevokeFailed'), 'error');
    } finally {
      setRevokingLinkId('');
    }
  };

  const copyToClipboard = useCallback(async (text, successMessage) => {
    if (!text) return;
    const fallbackCopy = () => {
      window.prompt(t('portalDocuments.clipboardPrompt'), text);
      return false;
    };
    let copied = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      } else {
        fallbackCopy();
      }
    } catch {
      fallbackCopy();
    }
    showFeedback(copied ? successMessage : t('portalDocuments.messages.clipboardFallback'), copied ? 'success' : 'info');
  }, [showFeedback, t]);

  if (showLocked) {
    return (
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, backgroundImage: 'none' }}>
        <EmptyState
          icon={<Lock sx={{ fontSize: 56 }} />}
          title={t('portalDocuments.lockedTitle')}
          description={t('portalDocuments.lockedBody')}
          actionLabel={t('portalDocuments.pricingLink')}
          actionHref={withDarkPath(pathname, '/pricing')}
        />
      </Paper>
    );
  }

  if (isTenant && !loading && documents.length === 0 && eligibleLeases.length === 0) {
    return null;
  }

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, backgroundImage: 'none' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
              {t('portalDocuments.heading')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('portalDocuments.subheading')}
            </Typography>
          </Box>
          {(!isTenant && docListView === 'deleted') ? null : (
            <Button
              type="button"
              variant="contained"
              size="small"
              startIcon={<UploadFile />}
              onClick={openUpload}
              sx={portalBtnSx}
            >
              {t('portalDocuments.upload')}
            </Button>
          )}
        </Stack>
      </Paper>

      {isTenant && eligibleLeases.some((l) => l.readonly_access) ? (
        <Alert severity="info">
          {t('portalDocuments.graceBanner')}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2, backgroundImage: 'none' }}>
        <Stack spacing={1.5}>
          {!isTenant ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
              <ToggleButtonGroup
                exclusive
                size="small"
                value={docListView}
                onChange={(_e, next) => {
                  if (next) setDocListView(next);
                }}
              >
                <ToggleButton value="active" aria-label={t('portalDocuments.viewActive')} sx={portalBtnSx}>
                  {t('portalDocuments.viewActive')}
                </ToggleButton>
                <ToggleButton value="deleted" aria-label={t('portalDocuments.viewDeleted')} sx={portalBtnSx}>
                  {t('portalDocuments.viewDeleted')}
                </ToggleButton>
              </ToggleButtonGroup>
              <PortalRefreshButton
                label={t('portalDocuments.refresh')}
                onClick={() => { void handleRefresh(); }}
                disabled={!baseUrl || showLocked}
                loading={refreshing}
              />
            </Stack>
          ) : (
            <Stack direction="row" justifyContent="flex-end">
              <PortalRefreshButton
                label={t('portalDocuments.refresh')}
                onClick={() => { void handleRefresh(); }}
                disabled={!baseUrl || showLocked}
                loading={refreshing}
              />
            </Stack>
          )}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'flex-start' }}>
            <TextField
              fullWidth
              size="small"
              label={t('portalDocuments.search')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
              sx={{ flex: { md: 1 }, minWidth: 0 }}
            />
            <FormControl size="small" sx={{ minWidth: { md: 200 }, width: { xs: '100%', md: 'auto' } }}>
              <InputLabel id="documents-filter-doc-type">{t('portalDocuments.type')}</InputLabel>
              <Select
                labelId="documents-filter-doc-type"
                label={t('portalDocuments.type')}
                value={filterDocumentType}
                onChange={(e) => setFilterDocumentType(e.target.value)}
              >
                <MenuItem value="">{t('portalDocuments.filterAny')}</MenuItem>
                {DOC_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>{documentTypeLabel(t, type)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {isTenant && tenantPropertyChoices.length > 0 ? (
              <FormControl size="small" sx={{ minWidth: { md: 200 }, width: { xs: '100%', md: 'auto' } }}>
                <InputLabel id="documents-filter-property-tenant">{t('portalDocuments.property')}</InputLabel>
                <Select
                  labelId="documents-filter-property-tenant"
                  label={t('portalDocuments.property')}
                  value={filterPropertyId}
                  onChange={(e) => {
                    setFilterPropertyId(e.target.value);
                    setFilterLeaseId('');
                  }}
                >
                  <MenuItem value="">{t('portalDocuments.filterAny')}</MenuItem>
                  {tenantPropertyChoices.map((row) => (
                    <MenuItem key={row.id} value={row.id}>{row.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            {isTenant && eligibleLeases.length > 0 ? (
              <FormControl size="small" sx={{ minWidth: { md: 220 }, width: { xs: '100%', md: 'auto' } }}>
                <InputLabel id="documents-filter-lease-tenant">{t('portalDocuments.lease')}</InputLabel>
                <Select
                  labelId="documents-filter-lease-tenant"
                  label={t('portalDocuments.lease')}
                  value={filterLeaseId}
                  onChange={(e) => setFilterLeaseId(e.target.value)}
                >
                  <MenuItem value="">{t('portalDocuments.filterAny')}</MenuItem>
                  {tenantLeasesForFilter.map((lease) => (
                    <MenuItem key={lease.lease_id} value={lease.lease_id}>
                      {lease.property_address || lease.property_label || lease.lease_label || lease.lease_id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            {isTenant && (filterPropertyId || filterLeaseId || filterDocumentType) ? (
              <Tooltip title={t('portalDocuments.clearFilters')}>
                <IconButton
                  type="button"
                  size="small"
                  onClick={clearDocFilters}
                  aria-label={t('portalDocuments.clearFilters')}
                  sx={{ ...portalToolbarIconBtnSx, alignSelf: { md: 'center' }, color: 'primary.main' }}
                >
                  <FilterAltOff fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
            {!isTenant ? (
              <>
                <FormControl size="small" sx={{ minWidth: { md: 200 }, width: { xs: '100%', md: 'auto' } }}>
                  <InputLabel id="documents-filter-property">{t('portalDocuments.property')}</InputLabel>
                  <Select
                    labelId="documents-filter-property"
                    label={t('portalDocuments.property')}
                    value={filterPropertyId}
                    onChange={(e) => {
                      setFilterPropertyId(e.target.value);
                      setFilterTenantUserId('');
                      setFilterLeaseId('');
                    }}
                  >
                    <MenuItem value="">{t('portalDocuments.filterAny')}</MenuItem>
                    {propertyOptions.map((property) => (
                      <MenuItem key={property.id} value={property.id}>
                        {property.addressLine || property.street || property.name || property.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl
                  size="small"
                  disabled={!filterPropertyId}
                  sx={{ minWidth: { md: 200 }, width: { xs: '100%', md: 'auto' } }}
                >
                  <InputLabel id="documents-filter-tenant">{t('portalDocuments.tenantFilter')}</InputLabel>
                  <Select
                    labelId="documents-filter-tenant"
                    label={t('portalDocuments.tenantFilter')}
                    value={filterTenantUserId}
                    disabled={!filterPropertyId}
                    onChange={(e) => {
                      setFilterTenantUserId(e.target.value);
                      setFilterLeaseId('');
                    }}
                  >
                    <MenuItem value="">{t('portalDocuments.filterAny')}</MenuItem>
                    {managementTenantsForFilter.map((row) => (
                      <MenuItem key={row.id} value={row.id}>{row.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl
                  size="small"
                  disabled={!filterTenantUserId}
                  sx={{ minWidth: { md: 220 }, width: { xs: '100%', md: 'auto' } }}
                >
                  <InputLabel id="documents-filter-lease">{t('portalDocuments.lease')}</InputLabel>
                  <Select
                    labelId="documents-filter-lease"
                    label={t('portalDocuments.lease')}
                    value={filterLeaseId}
                    disabled={!filterTenantUserId}
                    onChange={(e) => setFilterLeaseId(e.target.value)}
                  >
                    <MenuItem value="">{t('portalDocuments.filterAny')}</MenuItem>
                    {managementLeasesForFilter.map((lease) => (
                      <MenuItem key={lease.lease_id} value={lease.lease_id}>
                        {formatLeaseDateRangeOnly(lease, t)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Tooltip title={t('portalDocuments.clearFilters')}>
                  <IconButton
                    type="button"
                    size="small"
                    onClick={clearDocFilters}
                    aria-label={t('portalDocuments.clearFilters')}
                    sx={{ ...portalToolbarIconBtnSx, alignSelf: { md: 'center' }, color: 'primary.main' }}
                  >
                    <FilterAltOff fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ backgroundImage: 'none', overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<Description sx={{ fontSize: 56 }} />}
            title={(!isTenant && docListView === 'deleted') ? t('portalDocuments.emptyDeletedTitle') : t('portalDocuments.emptyTitle')}
            description={(!isTenant && docListView === 'deleted') ? t('portalDocuments.emptyDeletedBody') : t('portalDocuments.emptyBody')}
            actionLabel={(!isTenant && docListView === 'deleted') ? undefined : t('portalDocuments.upload')}
            onAction={(!isTenant && docListView === 'deleted') ? undefined : () => openUpload({ applyDocFilters: true })}
          />
        ) : (
          <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
            {documents.map((doc) => (
              <Box key={doc.id} sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'flex-start' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                        {displayName(doc)}
                      </Typography>
                      <Chip size="small" label={documentTypeLabel(t, doc.document_type)} />
                      <Chip size="small" color={scanChipColor(doc.scan_status)} label={t(`portalDocuments.scan.${doc.scan_status}`)} />
                      {doc.deleted_at ? <Chip size="small" color="warning" label={t('portalDocuments.deleted')} /> : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                      {doc.original_filename} · {formatBytes(doc.file_size_bytes)} · {doc.property_label || ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('portalDocuments.uploadedBy', {
                        name: doc.uploaded_by_display_name || t('portalDocuments.unknownUser'),
                        date: doc.created_at ? new Date(doc.created_at).toLocaleString() : '',
                      })}
                    </Typography>
                  </Box>
                  <Stack
                    direction="column"
                    spacing={1}
                    alignItems={{ xs: 'stretch', md: 'flex-end' }}
                    sx={{ flexShrink: 0 }}
                  >
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
                      alignItems="center"
                      sx={{ gap: 0.5 }}
                    >
                    <Tooltip title={t('portalDocuments.preview')}>
                      <span>
                        <IconButton
                          type="button"
                          size="small"
                          disabled={!isPreviewable(doc) || Boolean(doc.deleted_at)}
                          onClick={() => openFile(doc, 'preview')}
                          aria-label={t('portalDocuments.preview')}
                          sx={{ ...portalToolbarIconBtnSx, color: 'primary.main' }}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('portalDocuments.download')}>
                      <span>
                        <IconButton
                          type="button"
                          size="small"
                          disabled={!doc.can_download || Boolean(doc.deleted_at)}
                          onClick={() => openFile(doc, 'download')}
                          aria-label={t('portalDocuments.download')}
                          sx={{ ...portalToolbarIconBtnSx, color: 'primary.main' }}
                        >
                          <Download fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    {isLandlord && !doc.deleted_at ? (
                      <Tooltip title={t('portalDocuments.share')}>
                        <IconButton
                          type="button"
                          size="small"
                          onClick={() => { setShareDoc(doc); setShareResult(null); }}
                          aria-label={t('portalDocuments.share')}
                          sx={{ ...portalToolbarIconBtnSx, color: 'primary.main' }}
                        >
                          <Share fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    {!isTenant && doc.deleted_at ? (
                      <>
                        <Tooltip title={t('portalDocuments.restore')}>
                          <IconButton
                            type="button"
                            size="small"
                            onClick={() => handleRestore(doc)}
                            aria-label={t('portalDocuments.restore')}
                            sx={{ ...portalToolbarIconBtnSx, color: 'primary.main' }}
                          >
                            <Restore fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {docListView === 'deleted' ? (
                          <Tooltip title={t('portalDocuments.purgePermanent')}>
                            <IconButton
                              type="button"
                              size="small"
                              color="error"
                              onClick={() => setConfirmPurge(doc)}
                              aria-label={t('portalDocuments.purgePermanent')}
                              sx={portalToolbarIconBtnSx}
                            >
                              <DeleteForever fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                      </>
                    ) : null}
                    {!isTenant && !doc.deleted_at ? (
                      <Tooltip title={t('portalDocuments.delete')}>
                        <IconButton
                          type="button"
                          size="small"
                          color="error"
                          onClick={() => setConfirmDelete(doc)}
                          aria-label={t('portalDocuments.delete')}
                          sx={portalToolbarIconBtnSx}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    </Stack>
                    {!isTenant && !doc.deleted_at ? (
                      <FormControlLabel
                        sx={{
                          m: 0,
                          alignSelf: { xs: 'flex-start', md: 'flex-end' },
                          alignItems: 'center',
                          maxWidth: { md: 280 },
                          '& .MuiFormControlLabel-label': { textAlign: { xs: 'left', md: 'right' } },
                        }}
                        control={(
                          <Checkbox
                            size="small"
                            checked={documentSharedWithTenants(doc)}
                            disabled={sharingUpdatingId === doc.id}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setConfirmTenantVisibility({ doc });
                              } else {
                                void handleTenantSharingChange(doc, false);
                              }
                            }}
                          />
                        )}
                        label={(
                          <Typography component="span" variant="body2" color="text.secondary">
                            {t('portalDocuments.visibleToTenantsPortal')}
                          </Typography>
                        )}
                      />
                    ) : null}
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      <Dialog open={uploadOpen} onClose={closeUpload} fullWidth maxWidth="sm">
        <DialogTitle>{t('portalDocuments.uploadTitle')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {!isTenant ? (
              <>
                <FormControl fullWidth size="small" required>
                  <InputLabel id="document-upload-property-label">{t('portalDocuments.property')}</InputLabel>
                  <Select
                    labelId="document-upload-property-label"
                    label={t('portalDocuments.property')}
                    required
                    value={upload.uploadPropertyId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setUpload((prev) => ({
                        ...prev,
                        uploadPropertyId: v,
                        uploadTenantUserId: '',
                        uploadLeaseId: '',
                      }));
                    }}
                  >
                    <MenuItem value="" disabled>
                      <em>{t('portalDocuments.uploadSelectProperty')}</em>
                    </MenuItem>
                    {propertyOptions.map((property) => (
                      <MenuItem key={property.id} value={property.id}>
                        {property.addressLine || property.street || property.name || property.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small" disabled={!upload.uploadPropertyId}>
                  <InputLabel id="document-upload-tenant-label">{t('portalDocuments.uploadTenantOptional')}</InputLabel>
                  <Select
                    labelId="document-upload-tenant-label"
                    label={t('portalDocuments.uploadTenantOptional')}
                    value={upload.uploadTenantUserId}
                    disabled={!upload.uploadPropertyId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setUpload((prev) => ({
                        ...prev,
                        uploadTenantUserId: v,
                        uploadLeaseId: '',
                      }));
                    }}
                  >
                    <MenuItem value="">{t('portalDocuments.uploadSelectNone')}</MenuItem>
                    {uploadTenantsForSelect.map((row) => (
                      <MenuItem key={row.id} value={row.id}>
                        {row.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small" disabled={!upload.uploadTenantUserId}>
                  <InputLabel id="document-upload-lease-label">{t('portalDocuments.uploadLeaseOptional')}</InputLabel>
                  <Select
                    labelId="document-upload-lease-label"
                    label={t('portalDocuments.uploadLeaseOptional')}
                    value={upload.uploadLeaseId}
                    disabled={!upload.uploadTenantUserId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const row = leaseOptions.find((l) => String(l.lease_id) === String(id));
                      setUpload((prev) => {
                        const next = { ...prev, uploadLeaseId: id };
                        if (row) next.uploadPropertyId = String(row.property_id);
                        if (row && prev.uploadTenantUserId
                          && !parseTenantUserIdsFromLease(row).includes(normFilterId(prev.uploadTenantUserId))) {
                          next.uploadTenantUserId = '';
                        }
                        return next;
                      });
                    }}
                  >
                    <MenuItem value="">{t('portalDocuments.uploadSelectNone')}</MenuItem>
                    {uploadLeasesForSelect.map((lease) => (
                      <MenuItem key={lease.lease_id} value={lease.lease_id}>
                        {formatLeaseDateRangeOnly(lease, t)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            ) : (
              <FormControl fullWidth size="small">
                <InputLabel id="document-lease-label">{t('portalDocuments.lease')}</InputLabel>
                <Select
                  labelId="document-lease-label"
                  label={t('portalDocuments.lease')}
                  value={upload.uploadLeaseId}
                  onChange={(e) => setUpload((prev) => ({ ...prev, uploadLeaseId: e.target.value }))}
                >
                  {activeLeaseOptions.map((lease) => (
                    <MenuItem key={lease.lease_id} value={lease.lease_id}>
                      {lease.lease_label || lease.property_label || lease.lease_id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl fullWidth size="small">
              <InputLabel id="document-type-label">{t('portalDocuments.type')}</InputLabel>
              <Select
                labelId="document-type-label"
                label={t('portalDocuments.type')}
                value={upload.documentType}
                onChange={(e) => setUpload((prev) => ({ ...prev, documentType: e.target.value }))}
              >
                {DOC_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>{documentTypeLabel(t, type)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField size="small" label={t('portalDocuments.title')} value={upload.title} onChange={(e) => setUpload((prev) => ({ ...prev, title: e.target.value }))} />
            <TextField size="small" label={t('portalDocuments.note')} multiline minRows={2} value={upload.note} onChange={(e) => setUpload((prev) => ({ ...prev, note: e.target.value }))} />
            {!isTenant ? (
              <FormControlLabel
                control={<Checkbox checked={upload.shareWithTenants} onChange={(e) => setUpload((prev) => ({ ...prev, shareWithTenants: e.target.checked }))} />}
                label={t('portalDocuments.shareWithTenant')}
              />
            ) : null}
            <Paper
              variant="outlined"
              onDragEnter={handleUploadDragEnter}
              onDragLeave={handleUploadDragLeave}
              onDragOver={handleUploadDragOver}
              onDrop={handleUploadDrop}
              sx={{
                p: 2,
                borderStyle: 'dashed',
                borderWidth: 2,
                borderColor: uploadDragDepth > 0 ? 'primary.main' : 'divider',
                bgcolor: uploadDragDepth > 0 ? alpha(theme.palette.primary.main, 0.06) : theme.palette.action.hover,
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
                pointerEvents: uploading ? 'none' : 'auto',
                opacity: uploading ? 0.65 : 1,
              }}
            >
              <Stack spacing={1.25} alignItems="center">
                <UploadFile color={uploadDragDepth > 0 ? 'primary' : 'action'} sx={{ fontSize: 36, opacity: 0.85 }} />
                <Typography variant="body2" color="text.secondary" align="center">
                  {t('portalDocuments.dropHint')}
                </Typography>
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  startIcon={<UploadFile fontSize="small" />}
                  sx={portalBtnSx}
                >
                  {upload.file ? upload.file.name : t('portalDocuments.chooseFile')}
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => setUpload((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))}
                  />
                </Button>
              </Stack>
            </Paper>
            <Alert severity="warning">{t('portalDocuments.sensitiveWarning')}</Alert>
            <FormControlLabel
              control={<Checkbox checked={upload.sensitiveAcknowledged} onChange={(e) => setUpload((prev) => ({ ...prev, sensitiveAcknowledged: e.target.checked }))} />}
              label={t(isTenant ? 'portalDocuments.sensitiveAckTenant' : 'portalDocuments.sensitiveAckLandlord')}
            />
            {uploading ? <LinearProgress variant="determinate" value={uploadProgress} /> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={closeUpload} disabled={uploading} sx={portalBtnSx}>{t('common.cancel', 'Cancel')}</Button>
          <Button type="button" variant="contained" onClick={handleUpload} disabled={uploading} sx={portalBtnSx}>
            {uploading ? t('portalDocuments.uploading') : t('portalDocuments.upload')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={preview.open} onClose={() => setPreview({ open: false, doc: null, url: '' })} fullWidth maxWidth="lg">
        <DialogTitle>{preview.doc ? displayName(preview.doc) : t('portalDocuments.preview')}</DialogTitle>
        <DialogContent dividers sx={{ height: { xs: '70vh', md: '75vh' }, p: 0 }}>
          {preview.doc?.content_type?.startsWith('image/') ? (
            <Box component="img" src={preview.url} alt={displayName(preview.doc)} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <Box component="iframe" title={preview.doc ? displayName(preview.doc) : t('portalDocuments.preview')} src={preview.url} sx={{ border: 0, width: '100%', height: '100%' }} />
          )}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setPreview({ open: false, doc: null, url: '' })} sx={portalBtnSx}>{t('common.close', 'Close')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(shareDoc)} onClose={() => setShareDoc(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('portalDocuments.shareTitle')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {shareDoc ? displayName(shareDoc) : ''}
            </Typography>
            <TextField
              type="number"
              size="small"
              label={t('portalDocuments.expiresInDays')}
              value={shareOptions.expiresInDays}
              inputProps={{ min: 1, max: 30 }}
              onChange={(e) => setShareOptions((prev) => ({ ...prev, expiresInDays: e.target.value }))}
            />
            <FormControlLabel
              control={<Checkbox checked={shareOptions.requirePasscode} onChange={(e) => setShareOptions((prev) => ({ ...prev, requirePasscode: e.target.checked }))} />}
              label={t('portalDocuments.requirePasscode')}
            />
            {shareResult ? (
              <Alert severity="success">
                <Stack spacing={2}>
                  <Typography variant="body2">{t('portalDocuments.shareReady')}</Typography>
                  {absoluteShareUrl(shareResult) ? (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {t('portalDocuments.shareLinkUrl')}
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 1, backgroundImage: 'none' }}>
                        <Stack direction="row" spacing={0.5} alignItems="flex-start">
                          <Typography
                            component="a"
                            href={absoluteShareUrl(shareResult)}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="body2"
                            sx={{
                              flex: 1,
                              minWidth: 0,
                              color: 'primary.main',
                              overflowWrap: 'anywhere',
                              wordBreak: 'break-all',
                            }}
                          >
                            {absoluteShareUrl(shareResult)}
                          </Typography>
                          <Tooltip title={t('portalDocuments.copyShareUrl')}>
                            <IconButton
                              type="button"
                              size="small"
                              onClick={() => { void copyToClipboard(absoluteShareUrl(shareResult), t('portalDocuments.messages.shareUrlCopied')); }}
                              aria-label={t('portalDocuments.copyShareUrl')}
                              sx={{ ...portalToolbarIconBtnSx, flexShrink: 0, color: 'primary.main' }}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Paper>
                    </Box>
                  ) : null}
                  {shareResult.passcode ? (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {t('portalDocuments.passcode')}
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 1, backgroundImage: 'none' }}>
                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
                          <Typography variant="body2" sx={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.06em' }}>
                            {shareResult.passcode}
                          </Typography>
                          <Tooltip title={t('portalDocuments.copyPasscode')}>
                            <IconButton
                              type="button"
                              size="small"
                              onClick={() => { void copyToClipboard(String(shareResult.passcode), t('portalDocuments.messages.sharePasscodeCopied')); }}
                              aria-label={t('portalDocuments.copyPasscode')}
                              sx={{ ...portalToolbarIconBtnSx, flexShrink: 0, color: 'primary.main' }}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Paper>
                    </Box>
                  ) : null}
                </Stack>
              </Alert>
            ) : null}
            <Stack spacing={1}>
              <Typography variant="subtitle2">{t('portalDocuments.activeShareLinks')}</Typography>
              {shareLinksLoading ? <LinearProgress /> : null}
              {!shareLinksLoading && shareLinks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('portalDocuments.noShareLinks')}
                </Typography>
              ) : null}
              {shareLinks.map((link) => (
                <Paper key={link.id} variant="outlined" sx={{ p: 1.5, backgroundImage: 'none' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          color={link.active ? 'success' : 'default'}
                          label={link.active ? t('portalDocuments.shareActive') : t('portalDocuments.shareInactive')}
                        />
                        {link.passcode_required ? <Chip size="small" variant="outlined" label={t('portalDocuments.passcodeRequired')} /> : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                        {t('portalDocuments.expiresAt')}: {new Date(link.expires_at).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {t('portalDocuments.accessCount', { count: link.access_count ?? 0 })}
                      </Typography>
                    </Box>
                    {link.active ? (
                      <Tooltip title={revokingLinkId === link.id ? t('portalDocuments.revoking') : t('portalDocuments.revokeShare')}>
                        <span>
                          <IconButton
                            type="button"
                            size="small"
                            color="error"
                            disabled={revokingLinkId === link.id}
                            onClick={() => void handleRevokeShareLink(link.id)}
                            aria-label={t('portalDocuments.revokeShare')}
                            sx={portalToolbarIconBtnSx}
                          >
                            {revokingLinkId === link.id ? <CircularProgress size={18} color="inherit" /> : <LinkOff fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : null}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setShareDoc(null)} sx={portalBtnSx}>{t('common.close', 'Close')}</Button>
          <Button type="button" variant="contained" onClick={handleShare} sx={portalBtnSx}>{t('portalDocuments.createShare')}</Button>
        </DialogActions>
      </Dialog>

      <PortalConfirmDialog
        open={Boolean(confirmTenantVisibility)}
        title={t('portalDocuments.tenantVisibilityConfirmTitle')}
        body={confirmTenantVisibility ? t('portalDocuments.tenantVisibilityConfirmBody', { name: displayName(confirmTenantVisibility.doc) }) : ''}
        confirmLabel={t('portalDocuments.tenantVisibilityConfirm')}
        confirmColor="primary"
        loading={tenantVisibilityConfirmLoading}
        onClose={() => setConfirmTenantVisibility(null)}
        onConfirm={() => { void handleConfirmTenantVisibility(); }}
      />

      <PortalConfirmDialog
        open={Boolean(confirmDelete)}
        title={t('portalDocuments.deleteTitle')}
        body={confirmDelete ? t('portalDocuments.deleteDescription', { name: displayName(confirmDelete) }) : ''}
        confirmLabel={t('portalDocuments.delete')}
        confirmColor="error"
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />

      <PortalConfirmDialog
        open={Boolean(confirmPurge)}
        title={t('portalDocuments.purgeTitle')}
        body={confirmPurge ? t('portalDocuments.purgeDescription', { name: displayName(confirmPurge) }) : ''}
        confirmPhrase="delete"
        confirmPhraseHint={t('portalDocuments.purgePhraseHint')}
        confirmLabel={t('portalDocuments.purgeConfirm')}
        confirmColor="error"
        loading={purgeLoading}
        onClose={() => { if (!purgeLoading) setConfirmPurge(null); }}
        onConfirm={() => { void handlePurgePermanent(); }}
      />

      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </Stack>
  );
};

export default PortalDocuments;
