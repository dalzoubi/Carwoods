import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Build from '@mui/icons-material/Build';
import Chat from '@mui/icons-material/Chat';
import Update from '@mui/icons-material/Update';
import Notes from '@mui/icons-material/Notes';
import PersonAdd from '@mui/icons-material/PersonAdd';
import Email from '@mui/icons-material/Email';
import Warning from '@mui/icons-material/Warning';
import NotificationsNone from '@mui/icons-material/NotificationsNone';
import ContactMail from '@mui/icons-material/ContactMail';
import SupervisorAccount from '@mui/icons-material/SupervisorAccount';
import DoneAll from '@mui/icons-material/DoneAll';
import Close from '@mui/icons-material/Close';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePortalAuth } from '../PortalAuthContext';
import { withDarkPath } from '../routePaths';
import {
  dismissPortalNotificationFromTray,
  fetchNotifications,
  markAllNotificationsRead,
} from '../lib/portalApiClient';
import {
  formatNotificationAbsoluteTime,
  notificationOpenTargetFromRow,
  relativeTime,
  resolveNotificationDeepLink,
} from '../lib/notificationUtils';
import { usePortalRequestDetailModal } from './PortalRequestDetailModalContext';
import PortalRefreshButton from './PortalRefreshButton';

function eventIcon(eventTypeCode) {
  const code = String(eventTypeCode ?? '').toUpperCase();
  if (code === 'REQUEST_CREATED') return <Build fontSize="small" />;
  if (code === 'REQUEST_UPDATED') return <Update fontSize="small" />;
  if (code === 'REQUEST_MESSAGE_CREATED' || code === 'LANDLORD_MESSAGE_POSTED') return <Chat fontSize="small" />;
  if (code === 'REQUEST_INTERNAL_NOTE') return <Notes fontSize="small" />;
  if (code === 'ACCOUNT_ONBOARDED_WELCOME') return <PersonAdd fontSize="small" />;
  if (code === 'ACCOUNT_EMAIL_VERIFICATION') return <Email fontSize="small" />;
  if (code === 'SECURITY_NOTIFICATION_DELIVERY_FAILURE') return <Warning fontSize="small" color="warning" />;
  if (code === 'CONTACT_REQUEST_CREATED') return <ContactMail fontSize="small" />;
  if (code === 'ACCOUNT_LANDLORD_CREATED') return <SupervisorAccount fontSize="small" />;
  return <NotificationsNone fontSize="small" />;
}

function notificationBody(notification) {
  const meta = notification.metadata_json;
  if (meta && typeof meta === 'object' && typeof meta.ai_summary === 'string' && meta.ai_summary.trim()) {
    return meta.ai_summary.trim();
  }
  return notification.body;
}

const PortalNotificationsInbox = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated, account, getAccessToken, baseUrl, handleApiForbidden } = usePortalAuth();
  const { openRequestDetail, isAvailable: requestDetailModalAvailable } = usePortalRequestDetailModal();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [dismissing, setDismissing] = useState(new Set());

  const emailHint = account?.username || undefined;

  const load = useCallback(async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!isAuthenticated || !baseUrl) return;
    if (!silent) setLoading(true);
    try {
      const token = await getAccessToken();
      const payload = await fetchNotifications(baseUrl, token, { emailHint, limit: 50 });
      setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
    } catch (error) {
      handleApiForbidden?.(error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAuthenticated, baseUrl, getAccessToken, emailHint, handleApiForbidden]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void load({ silent: true });
    };
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refresh();
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthenticated, load]);

  const handleDismiss = useCallback(async (notification, navigate_after = false) => {
    if (!baseUrl) return;
    setDismissing((prev) => new Set(prev).add(notification.id));
    try {
      const token = await getAccessToken();
      await dismissPortalNotificationFromTray(baseUrl, token, notification.id, { emailHint });
      const nowIso = new Date().toISOString();
      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id
            ? {
              ...item,
              read_at: item.read_at || nowIso,
              dismissed_from_tray_at: nowIso,
            }
            : item
        )
      );
      if (navigate_after) {
        const target = resolveNotificationDeepLink(notification) || String(notification.deep_link ?? '').trim();
        const { requestId, highlight } = notificationOpenTargetFromRow(notification);
        const highlightKeys = Object.keys(highlight);
        if (requestId && requestDetailModalAvailable) {
          openRequestDetail(requestId, highlightKeys.length ? highlight : null);
        } else if (target) {
          navigate(withDarkPath(pathname, target));
        }
      }
    } catch (error) {
      handleApiForbidden?.(error);
    } finally {
      setDismissing((prev) => {
        const next = new Set(prev);
        next.delete(notification.id);
        return next;
      });
    }
  }, [
    baseUrl,
    getAccessToken,
    emailHint,
    navigate,
    pathname,
    handleApiForbidden,
    openRequestDetail,
    requestDetailModalAvailable,
  ]);

  const handleMarkAllRead = useCallback(async () => {
    if (!baseUrl) return;
    setMarkingAll(true);
    try {
      const token = await getAccessToken();
      await markAllNotificationsRead(baseUrl, token, { emailHint });
      setNotifications((items) =>
        items.map((item) => ({
          ...item,
          read_at: item.read_at || new Date().toISOString(),
        }))
      );
    } catch (error) {
      handleApiForbidden?.(error);
    } finally {
      setMarkingAll(false);
    }
  }, [baseUrl, getAccessToken, emailHint, handleApiForbidden]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <>
      <Helmet>
        <title>{t('portalNotificationsInbox.pageTitle')}</title>
      </Helmet>

      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            {t('portalNotificationsInbox.heading')}
          </Typography>
          {!loading && (
            <Typography variant="body2" color="text.secondary">
              {unreadCount > 0
                ? t('portalHeader.notifications.unreadCount', { count: unreadCount })
                : t('portalNotificationsInbox.allRead')}
            </Typography>
          )}
        </Box>
        <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
          <PortalRefreshButton
            label={t('portalNotificationsInbox.refresh')}
            onClick={() => { void handleRefresh(); }}
            disabled={!isAuthenticated || !baseUrl}
            loading={refreshing}
          />
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={markingAll ? <CircularProgress size={14} /> : <DoneAll fontSize="small" />}
              onClick={handleMarkAllRead}
              disabled={markingAll}
              variant="outlined"
            >
              {t('portalNotificationsInbox.markAllRead')}
            </Button>
          )}
        </Stack>
      </Stack>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={28} />
        </Box>
      ) : notifications.length === 0 ? (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          py={8}
          gap={1}
          color="text.secondary"
        >
          <NotificationsNone sx={{ fontSize: 48, opacity: 0.3 }} />
          <Typography variant="body2">{t('portalHeader.notifications.empty')}</Typography>
        </Box>
      ) : (
        <List disablePadding>
          {notifications.map((notification, idx) => {
            const isUnread = !notification.read_at;
            const isDismissing = dismissing.has(notification.id);
            const body = notificationBody(notification);
            const resolvedLink = resolveNotificationDeepLink(notification)
              || String(notification.deep_link ?? '').trim();
            const { requestId: openRequestId } = notificationOpenTargetFromRow(notification);
            const hasLink = Boolean(
              (openRequestId && requestDetailModalAvailable)
              || resolvedLink
            );
            return (
              <React.Fragment key={notification.id}>
                {idx > 0 && <Divider />}
                <ListItem
                  disablePadding
                  sx={{
                    px: 2,
                    py: 1.5,
                    gap: 1.5,
                    alignItems: 'flex-start',
                    backgroundColor: isUnread ? 'action.hover' : 'transparent',
                    borderRadius: 1,
                    transition: 'background-color 0.2s',
                  }}
                >
                  <Box
                    sx={{
                      mt: 0.25,
                      color: isUnread ? 'primary.main' : 'text.disabled',
                      flexShrink: 0,
                    }}
                  >
                    {eventIcon(notification.event_type_code)}
                  </Box>

                  <Box
                    {...(hasLink
                      ? {
                          role: 'button',
                          tabIndex: 0,
                          onClick: () => { void handleDismiss(notification, true); },
                          onKeyDown: (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              void handleDismiss(notification, true);
                            }
                          },
                          'aria-label': notification.title,
                        }
                      : {})}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      cursor: hasLink ? 'pointer' : 'default',
                      borderRadius: 1,
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.light',
                        outlineOffset: '2px',
                      },
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={isUnread ? 700 : 400}
                      sx={{ mb: 0.25 }}
                    >
                      {notification.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {body}
                    </Typography>
                    {notification.created_at ? (
                      <Tooltip
                        title={formatNotificationAbsoluteTime(notification.created_at, i18n.language)}
                        arrow
                        enterDelay={400}
                      >
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.disabled"
                          sx={{ mt: 0.5, display: 'block', cursor: 'default', width: 'fit-content' }}
                        >
                          {relativeTime(notification.created_at, i18n.language)}
                        </Typography>
                      </Tooltip>
                    ) : null}
                  </Box>

                  {isUnread && (
                    <Tooltip title={t('portalNotificationsInbox.dismiss')} arrow>
                      <span>
                        <IconButton
                          type="button"
                          size="small"
                          color="inherit"
                          onClick={() => void handleDismiss(notification, false)}
                          disabled={isDismissing}
                          aria-label={t('portalNotificationsInbox.dismiss')}
                          sx={{ mt: -0.5, flexShrink: 0 }}
                        >
                          {isDismissing ? <CircularProgress size={14} /> : <Close fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
      )}
    </>
  );
};

export default PortalNotificationsInbox;
