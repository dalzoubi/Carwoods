import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  Tooltip,
  Typography,
} from '@mui/material';
import Build from '@mui/icons-material/Build';
import Chat from '@mui/icons-material/Chat';
import ClearAll from '@mui/icons-material/ClearAll';
import Close from '@mui/icons-material/Close';
import DoneAll from '@mui/icons-material/DoneAll';
import Email from '@mui/icons-material/Email';
import Notes from '@mui/icons-material/Notes';
import NotificationsNone from '@mui/icons-material/NotificationsNone';
import PersonAdd from '@mui/icons-material/PersonAdd';
import Science from '@mui/icons-material/Science';
import ContactMail from '@mui/icons-material/ContactMail';
import SupervisorAccount from '@mui/icons-material/SupervisorAccount';
import Update from '@mui/icons-material/Update';
import Warning from '@mui/icons-material/Warning';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { notificationsPollIntervalMs } from '../featureFlags';
import { usePortalAuth } from '../PortalAuthContext';
import { withDarkPath } from '../routePaths';
import {
  notificationOpenTargetFromRow,
  relativeTime,
  resolveNotificationDeepLink,
} from '../lib/notificationUtils';
import { usePortalRequestDetailModal } from './PortalRequestDetailModalContext';
import {
  addTrayHiddenIdForAccount,
  loadMergedTrayHiddenIds,
  selectNotificationsForTray,
  trayStorageUserKeys,
} from '../lib/notificationTrayPrefs';
import {
  dismissPortalNotificationFromTray,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/portalApiClient';
import { usePortalFeedback } from '../hooks/usePortalFeedback';
import PortalFeedbackSnackbar from './PortalFeedbackSnackbar';

function notificationEventIcon(eventTypeCode) {
  const code = String(eventTypeCode ?? '').toUpperCase();
  if (code === 'REQUEST_CREATED') return <Build sx={{ fontSize: 16 }} />;
  if (code === 'REQUEST_UPDATED') return <Update sx={{ fontSize: 16 }} />;
  if (code === 'REQUEST_MESSAGE_CREATED' || code === 'LANDLORD_MESSAGE_POSTED') {
    return <Chat sx={{ fontSize: 16 }} />;
  }
  if (code === 'REQUEST_INTERNAL_NOTE') return <Notes sx={{ fontSize: 16 }} />;
  if (code === 'ACCOUNT_ONBOARDED_WELCOME') return <PersonAdd sx={{ fontSize: 16 }} />;
  if (code === 'ACCOUNT_EMAIL_VERIFICATION') return <Email sx={{ fontSize: 16 }} />;
  if (code === 'SECURITY_NOTIFICATION_DELIVERY_FAILURE') {
    return <Warning sx={{ fontSize: 16 }} color="warning" />;
  }
  if (code === 'ADMIN_NOTIFICATION_TEST') return <Science sx={{ fontSize: 16 }} />;
  if (code === 'CONTACT_REQUEST_CREATED') return <ContactMail sx={{ fontSize: 16 }} />;
  if (code === 'ACCOUNT_LANDLORD_CREATED') return <SupervisorAccount sx={{ fontSize: 16 }} />;
  return <NotificationsNone sx={{ fontSize: 16 }} />;
}

function resolvedBody(notification) {
  const meta = notification.metadata_json;
  if (meta && typeof meta === 'object' && typeof meta.ai_summary === 'string' && meta.ai_summary.trim()) {
    return meta.ai_summary.trim();
  }
  return notification.body;
}

/**
 * Shared notification bell + tray (portal top bar and marketing navbar).
 * Exposes `close()` via ref so parents can dismiss the tray when opening other menus.
 */
const PortalNotificationsTray = forwardRef(function PortalNotificationsTray(
  {
    buttonId,
    menuId,
    onMenuWillOpen,
    iconButtonSx,
    iconButtonColor,
    menuProps,
  },
  ref
) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { openRequestDetail, isAvailable: requestDetailModalAvailable } = usePortalRequestDetailModal();
  const {
    isAuthenticated,
    account,
    getAccessToken,
    baseUrl,
    handleApiForbidden,
  } = usePortalAuth();

  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [dismissingIds, setDismissingIds] = useState(new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const [dismissingAll, setDismissingAll] = useState(false);
  const [trayHiddenIds, setTrayHiddenIds] = useState(() => new Set());
  const { feedback, showFeedback, closeFeedback } = usePortalFeedback();

  const trayPersistReady = trayStorageUserKeys(account).length > 0;

  useEffect(() => {
    if (!trayPersistReady) {
      setTrayHiddenIds(new Set());
      return;
    }
    setTrayHiddenIds(loadMergedTrayHiddenIds(account));
  }, [account, trayPersistReady]);

  const trayNotifications = useMemo(
    () => selectNotificationsForTray(notifications, trayHiddenIds),
    [notifications, trayHiddenIds]
  );

  const loadNotifications = useCallback(async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!isAuthenticated || !baseUrl) return;
    if (!silent) setNotificationsLoading(true);
    try {
      const token = await getAccessToken();
      const payload = await fetchNotifications(baseUrl, token, {
        emailHint: account?.username || undefined,
        limit: 20,
      });
      setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
      setUnreadCount(Number(payload?.unread_count ?? 0));
    } catch (error) {
      handleApiForbidden?.(error);
    } finally {
      if (!silent) setNotificationsLoading(false);
    }
  }, [account?.username, baseUrl, getAccessToken, handleApiForbidden, isAuthenticated]);

  const handleClose = useCallback(() => setAnchorEl(null), []);

  useImperativeHandle(ref, () => ({ close: handleClose }), [handleClose]);

  const handleOpen = (e) => {
    onMenuWillOpen?.();
    setAnchorEl(e.currentTarget);
    void loadNotifications();
  };

  const handleNotificationClick = async (notification) => {
    if (!baseUrl) return;
    try {
      const token = await getAccessToken();
      const response = await markNotificationRead(baseUrl, token, notification.id, {
        emailHint: account?.username || undefined,
      });
      if (typeof response?.unread_count === 'number') {
        setUnreadCount(response.unread_count);
      } else {
        setUnreadCount((value) => Math.max(0, value - 1));
      }
      setNotifications((items) => items.map((item) => (
        item.id === notification.id ? { ...item, read_at: item.read_at || new Date().toISOString() } : item
      )));
      const { requestId, highlight } = notificationOpenTargetFromRow(notification);
      const highlightKeys = Object.keys(highlight);
      if (requestId && requestDetailModalAvailable) {
        openRequestDetail(requestId, highlightKeys.length ? highlight : null);
      } else {
        const target = resolveNotificationDeepLink(notification);
        if (target) {
          navigate(withDarkPath(pathname, target));
        }
      }
    } catch (error) {
      handleApiForbidden?.(error);
    } finally {
      handleClose();
    }
  };

  const handleDismissNotification = async (e, notification) => {
    e.stopPropagation();
    if (dismissingIds.has(notification.id)) return;
    if (!baseUrl && !trayPersistReady) return;
    setDismissingIds((prev) => new Set(prev).add(notification.id));
    const emailHint = account?.username || undefined;
    const nowIso = new Date().toISOString();
    try {
      if (baseUrl) {
        const token = await getAccessToken();
        const response = await dismissPortalNotificationFromTray(baseUrl, token, notification.id, {
          emailHint,
        });
        if (typeof response?.unread_count === 'number') {
          setUnreadCount(response.unread_count);
        } else if (!notification.read_at) {
          setUnreadCount((value) => Math.max(0, value - 1));
        }
        setNotifications((items) => items.map((item) => (
          item.id === notification.id
            ? {
              ...item,
              read_at: item.read_at || nowIso,
              dismissed_from_tray_at: nowIso,
            }
            : item
        )));
      } else if (trayPersistReady) {
        setTrayHiddenIds((prev) => addTrayHiddenIdForAccount(account, notification.id, prev));
      }
    } catch (error) {
      handleApiForbidden?.(error);
      if (trayPersistReady) {
        setTrayHiddenIds((prev) => addTrayHiddenIdForAccount(account, notification.id, prev));
        /* Dismiss only persisted locally — warn the user it won't sync to other devices. */
        showFeedback(
          t('portalHeader.notifications.dismissOfflineFallback'),
          'warning'
        );
      } else {
        showFeedback(
          t('portalHeader.notifications.dismissError'),
          'error'
        );
      }
    } finally {
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.delete(notification.id);
        return next;
      });
    }
  };

  const handleMarkAllRead = async () => {
    if (!baseUrl || markingAll) return;
    setMarkingAll(true);
    try {
      const token = await getAccessToken();
      await markAllNotificationsRead(baseUrl, token, { emailHint: account?.username || undefined });
      setNotifications((items) => items.map((item) => ({
        ...item,
        read_at: item.read_at || new Date().toISOString(),
      })));
      setUnreadCount(0);
    } catch (error) {
      handleApiForbidden?.(error);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDismissAll = async () => {
    if (dismissingAll || trayNotifications.length === 0) return;
    if (!baseUrl && !trayPersistReady) return;
    setDismissingAll(true);
    const emailHint = account?.username || undefined;
    const nowIso = new Date().toISOString();
    const ids = trayNotifications.map((n) => n.id);
    try {
      if (baseUrl) {
        const token = await getAccessToken();
        const results = await Promise.allSettled(
          ids.map((id) => dismissPortalNotificationFromTray(baseUrl, token, id, { emailHint }))
        );
        let lastUnreadCount = null;
        const succeededIds = new Set();
        results.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            succeededIds.add(ids[i]);
            if (typeof result.value?.unread_count === 'number') {
              lastUnreadCount = result.value.unread_count;
            }
          }
        });
        if (succeededIds.size > 0) {
          setNotifications((items) => items.map((item) => (
            succeededIds.has(item.id)
              ? { ...item, read_at: item.read_at || nowIso, dismissed_from_tray_at: nowIso }
              : item
          )));
          if (lastUnreadCount !== null) {
            setUnreadCount(lastUnreadCount);
          }
        }
        const failedIds = ids.filter((id) => !succeededIds.has(id));
        if (failedIds.length > 0) {
          if (trayPersistReady) {
            setTrayHiddenIds((prev) => {
              let next = prev;
              failedIds.forEach((id) => { next = addTrayHiddenIdForAccount(account, id, next); });
              return next;
            });
            showFeedback(t('portalHeader.notifications.dismissOfflineFallback'), 'warning');
          } else if (succeededIds.size === 0) {
            showFeedback(t('portalHeader.notifications.dismissAllError'), 'error');
          }
        }
      } else if (trayPersistReady) {
        setTrayHiddenIds((prev) => {
          let next = prev;
          ids.forEach((id) => { next = addTrayHiddenIdForAccount(account, id, next); });
          return next;
        });
      }
    } catch (error) {
      handleApiForbidden?.(error);
      showFeedback(t('portalHeader.notifications.dismissAllError'), 'error');
    } finally {
      setDismissingAll(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    void loadNotifications();
  }, [isAuthenticated, loadNotifications]);

  const onNotificationsPage = pathname.includes('/portal/inbox/notifications');

  useEffect(() => {
    if (!isAuthenticated || onNotificationsPage) return undefined;
    const trayOpen = Boolean(anchorEl);
    const intervalMs = notificationsPollIntervalMs(trayOpen);
    const timerId = window.setInterval(() => {
      void loadNotifications({ silent: true });
    }, intervalMs);
    return () => window.clearInterval(timerId);
  }, [isAuthenticated, loadNotifications, anchorEl, onNotificationsPage]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadNotifications({ silent: true });
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
  }, [isAuthenticated, loadNotifications]);

  if (!isAuthenticated) {
    return null;
  }

  const listLabelledBy = buttonId;

  return (
    <>
      <Tooltip title={t('portalHeader.notifications.title')} arrow>
        <IconButton
          type="button"
          size="small"
          id={buttonId}
          color={iconButtonColor}
          onClick={handleOpen}
          aria-haspopup="true"
          aria-expanded={Boolean(anchorEl)}
          aria-controls={anchorEl ? menuId : undefined}
          aria-label={t('portalHeader.notifications.title')}
          sx={iconButtonSx}
        >
          <Badge
            color="error"
            badgeContent={unreadCount > 99 ? '99+' : unreadCount}
            invisible={unreadCount <= 0}
          >
            <NotificationsNone fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        {...(menuProps || {})}
        id={menuId}
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { backgroundImage: 'none', minWidth: 340, maxWidth: 440 } } }}
        MenuListProps={{ 'aria-labelledby': listLabelledBy, disablePadding: true }}
      >
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="subtitle2">{t('portalHeader.notifications.title')}</Typography>
            {unreadCount > 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('portalHeader.notifications.unreadCount', { count: unreadCount })}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {trayNotifications.length > 0 && (
              <Tooltip title={t('portalHeader.notifications.dismissAll')} arrow>
                <span>
                  <IconButton
                    type="button"
                    size="small"
                    color="inherit"
                    onClick={() => { void handleDismissAll(); }}
                    disabled={dismissingAll}
                    aria-label={t('portalHeader.notifications.dismissAll')}
                  >
                    {dismissingAll ? <CircularProgress size={14} /> : <ClearAll fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {unreadCount > 0 && (
              <Tooltip title={t('portalHeader.notifications.markAllRead')} arrow>
                <span>
                  <IconButton
                    type="button"
                    size="small"
                    color="success"
                    onClick={() => { void handleMarkAllRead(); }}
                    disabled={markingAll}
                    aria-label={t('portalHeader.notifications.markAllRead')}
                  >
                    {markingAll ? <CircularProgress size={14} /> : <DoneAll fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        </Box>
        <Divider />

        {notificationsLoading ? (
          <Box sx={{ px: 2, py: 3, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={18} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ px: 2, py: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              {t('portalHeader.notifications.empty')}
            </Typography>
          </Box>
        ) : trayNotifications.length === 0 ? (
          <Box sx={{ px: 2, py: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              {t('portalHeader.notifications.emptyTrayFiltered')}
            </Typography>
          </Box>
        ) : trayNotifications.map((notification) => {
          const isUnread = !notification.read_at;
          const isDismissing = dismissingIds.has(notification.id);
          const activateNotification = () => { void handleNotificationClick(notification); };
          return (
            <Box
              key={notification.id}
              role="button"
              tabIndex={0}
              onClick={activateNotification}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  activateNotification();
                }
              }}
              aria-label={notification.title}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                px: 2,
                py: 1.25,
                cursor: 'pointer',
                backgroundColor: isUnread ? 'action.hover' : 'transparent',
                '&:hover': { backgroundColor: 'action.focus' },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.light',
                  outlineOffset: '-2px',
                  backgroundColor: 'action.focus',
                },
                transition: 'background-color 0.15s',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ mt: 0.2, color: isUnread ? 'primary.main' : 'text.disabled', flexShrink: 0 }}>
                {notificationEventIcon(notification.event_type_code)}
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={isUnread ? 700 : 500} noWrap>
                  {notification.title}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {resolvedBody(notification)}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                  {notification.created_at ? relativeTime(notification.created_at, i18n.language) : ''}
                </Typography>
              </Box>

              <Tooltip title={t('portalHeader.notifications.dismiss')} arrow>
                <span>
                  <IconButton
                    type="button"
                    size="small"
                    color="inherit"
                    onClick={(e) => { void handleDismissNotification(e, notification); }}
                    disabled={isDismissing}
                    aria-label={t('portalHeader.notifications.dismiss')}
                    sx={{
                      mt: -0.5,
                      flexShrink: 0,
                      /* Ensure at least 32x32 hit area on desktop; MUI IconButton pads
                         to 40x40 on touch via density settings. */
                      p: 0.75,
                    }}
                  >
                    {isDismissing ? <CircularProgress size={12} /> : <Close sx={{ fontSize: 16 }} />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          );
        })}

        <Divider />
        <Box sx={{ px: 1, py: 0.5 }}>
          <Button
            component="a"
            href={withDarkPath(pathname, '/portal/inbox/notifications')}
            onClick={(e) => {
              e.preventDefault();
              handleClose();
              navigate(withDarkPath(pathname, '/portal/inbox/notifications'));
            }}
            size="small"
            sx={{ textTransform: 'none', width: '100%', justifyContent: 'center' }}
          >
            {t('portalHeader.notifications.viewAll')}
          </Button>
        </Box>
      </Menu>
      <PortalFeedbackSnackbar feedback={feedback} onClose={closeFeedback} />
    </>
  );
});

export default PortalNotificationsTray;
