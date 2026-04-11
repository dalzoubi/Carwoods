import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Refresh from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { usePortalAuth } from '../PortalAuthContext';
import { emailFromAccount, normalizeRole, resolveRole } from '../portalUtils';
import { Role } from '../domain/constants.js';
import { fetchElsaSettings, patchElsaSettings } from '../lib/portalApiClient';
import StatusAlertSlot from './StatusAlertSlot';

function errorMessage(error) {
  if (error && typeof error === 'object' && typeof error.message === 'string') {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'request_failed';
}

const PortalAdminAiAgents = () => {
  const { t } = useTranslation();
  const {
    baseUrl,
    isAuthenticated,
    account,
    meData,
    getAccessToken,
    handleApiForbidden,
  } = usePortalAuth();
  const role = normalizeRole(resolveRole(meData, account));
  const isAdmin = role === Role.ADMIN;
  const canUseModule = isAuthenticated && isAdmin && Boolean(baseUrl);

  const [loadStatus, setLoadStatus] = useState('idle');
  const [loadError, setLoadError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [agents, setAgents] = useState([]);
  const [routing, setRouting] = useState({
    primary_agent_id: '',
    fallback_agent_id: '',
  });

  const load = useCallback(async () => {
    if (!canUseModule || !baseUrl) {
      setLoadStatus('idle');
      setLoadError('');
      setAgents([]);
      setRouting({ primary_agent_id: '', fallback_agent_id: '' });
      return;
    }

    setLoadStatus('loading');
    setLoadError('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      const payload = await fetchElsaSettings(baseUrl, token, { emailHint });
      const agentRows = Array.isArray(payload?.agents) ? payload.agents : [];
      setAgents(agentRows);
      setRouting({
        primary_agent_id: String(payload?.routing?.primary_agent_id ?? ''),
        fallback_agent_id: String(payload?.routing?.fallback_agent_id ?? ''),
      });
      setLoadStatus('ok');
    } catch (error) {
      handleApiForbidden(error);
      setLoadStatus('error');
      setLoadError(errorMessage(error));
    }
  }, [account, baseUrl, canUseModule, getAccessToken, handleApiForbidden]);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledAgents = useMemo(
    () => agents.filter((agent) => Boolean(agent?.enabled)),
    [agents]
  );

  const selectedPrimary = useMemo(
    () => enabledAgents.find((agent) => String(agent.id) === routing.primary_agent_id) ?? null,
    [enabledAgents, routing.primary_agent_id]
  );
  const selectedFallback = useMemo(
    () => enabledAgents.find((agent) => String(agent.id) === routing.fallback_agent_id) ?? null,
    [enabledAgents, routing.fallback_agent_id]
  );

  const onSaveRouting = async () => {
    if (!canUseModule || !baseUrl || !routing.primary_agent_id) return;
    setSaveStatus('saving');
    setSaveMessage('');
    try {
      const token = await getAccessToken();
      const emailHint = emailFromAccount(account);
      await patchElsaSettings(baseUrl, token, {
        emailHint,
        primary_agent_id: routing.primary_agent_id,
        fallback_agent_id: routing.fallback_agent_id || null,
      });
      setSaveStatus('ok');
      setSaveMessage(t('portalAdminAiAgents.messages.routingSaved'));
      await load();
    } catch (error) {
      handleApiForbidden(error);
      setSaveStatus('error');
      setSaveMessage(errorMessage(error));
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1 }}>
          <Box>
            <Typography variant="h2" sx={{ fontSize: '1.25rem' }}>
              {t('portalAdminAiAgents.heading')}
            </Typography>
            <Typography color="text.secondary">{t('portalAdminAiAgents.intro')}</Typography>
          </Box>
          <Button
            type="button"
            size="small"
            variant="outlined"
            onClick={() => void load()}
            disabled={!canUseModule || loadStatus === 'loading'}
            startIcon={loadStatus === 'loading' ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
          >
            {t('portalAdminAiAgents.actions.refresh')}
          </Button>
        </Stack>

        <StatusAlertSlot
          message={!baseUrl ? { severity: 'warning', text: t('portalAdminAiAgents.errors.apiUnavailable') } : null}
        />
        <StatusAlertSlot
          message={!isAuthenticated ? { severity: 'warning', text: t('portalAdminAiAgents.errors.signInRequired') } : null}
        />
        <StatusAlertSlot
          message={isAuthenticated && !isAdmin
            ? { severity: 'error', text: t('portalAdminAiAgents.errors.adminOnly') }
            : null}
        />
        <StatusAlertSlot
          message={loadStatus === 'error'
            ? { severity: 'error', text: loadError || t('portalAdminAiAgents.errors.loadFailed') }
            : null}
        />

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h3" sx={{ fontSize: '1.05rem' }}>
              {t('portalAdminAiAgents.routing.heading')}
            </Typography>
            <FormControl>
              <InputLabel id="primary-agent-label">{t('portalAdminAiAgents.routing.primary')}</InputLabel>
              <Select
                labelId="primary-agent-label"
                label={t('portalAdminAiAgents.routing.primary')}
                value={routing.primary_agent_id}
                onChange={(event) => {
                  const nextPrimaryId = String(event.target.value || '');
                  setRouting((prev) => ({
                    primary_agent_id: nextPrimaryId,
                    fallback_agent_id: prev.fallback_agent_id === nextPrimaryId ? '' : prev.fallback_agent_id,
                  }));
                  if (saveStatus !== 'saving') {
                    setSaveStatus('idle');
                    setSaveMessage('');
                  }
                }}
                disabled={!canUseModule || saveStatus === 'saving'}
              >
                {enabledAgents.map((agent) => (
                  <MenuItem key={agent.id} value={agent.id}>
                    {agent.display_name} ({agent.primary_model})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <InputLabel id="fallback-agent-label">{t('portalAdminAiAgents.routing.fallback')}</InputLabel>
              <Select
                labelId="fallback-agent-label"
                label={t('portalAdminAiAgents.routing.fallback')}
                value={routing.fallback_agent_id}
                onChange={(event) => {
                  setRouting((prev) => ({
                    ...prev,
                    fallback_agent_id: String(event.target.value || ''),
                  }));
                  if (saveStatus !== 'saving') {
                    setSaveStatus('idle');
                    setSaveMessage('');
                  }
                }}
                disabled={!canUseModule || saveStatus === 'saving'}
              >
                <MenuItem value="">{t('portalAdminAiAgents.routing.none')}</MenuItem>
                {enabledAgents
                  .filter((agent) => String(agent.id) !== routing.primary_agent_id)
                  .map((agent) => (
                    <MenuItem key={agent.id} value={agent.id}>
                      {agent.display_name} ({agent.primary_model})
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={1.25}>
              <Button
                type="button"
                variant="contained"
                onClick={() => void onSaveRouting()}
                disabled={!canUseModule || saveStatus === 'saving' || !routing.primary_agent_id}
              >
                {saveStatus === 'saving'
                  ? t('portalAdminAiAgents.actions.saving')
                  : t('portalAdminAiAgents.actions.saveRouting')}
              </Button>
            </Stack>
            <StatusAlertSlot
              message={saveStatus === 'ok'
                ? { severity: 'success', text: saveMessage }
                : null}
            />
            <StatusAlertSlot
              message={saveStatus === 'error'
                ? { severity: 'error', text: saveMessage || t('portalAdminAiAgents.errors.saveFailed') }
                : null}
            />
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="h3" sx={{ fontSize: '1.05rem' }}>
              {t('portalAdminAiAgents.details.heading')}
            </Typography>
            <TextField
              label={t('portalAdminAiAgents.details.primaryAgent')}
              value={selectedPrimary ? selectedPrimary.display_name : '-'}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label={t('portalAdminAiAgents.details.primaryModel')}
              value={selectedPrimary ? selectedPrimary.primary_model : '-'}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label={t('portalAdminAiAgents.details.fallbackAgent')}
              value={selectedFallback ? selectedFallback.display_name : t('portalAdminAiAgents.routing.none')}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label={t('portalAdminAiAgents.details.fallbackModel')}
              value={selectedFallback ? selectedFallback.primary_model : '-'}
              InputProps={{ readOnly: true }}
            />
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  );
};

export default PortalAdminAiAgents;
