import { RequestStatus } from '../../domain/constants';

export function getStatusChipSx(statusCode, theme) {
  const normalized = String(statusCode || '').toUpperCase();
  const isDark = theme.palette.mode === 'dark';

  if (normalized === RequestStatus.NOT_STARTED) {
    return {
      bgcolor: isDark ? 'rgba(255, 255, 255, 0.16)' : '#FFFFFF',
      color: isDark ? '#F3F4F6' : '#111827',
      border: '1px solid',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.34)' : '#D1D5DB',
    };
  }

  if ([RequestStatus.ACKNOWLEDGED, RequestStatus.SCHEDULED].includes(normalized)) {
    return {
      bgcolor: isDark ? '#8A6A12' : '#FFE8A3',
      color: isDark ? '#FFF4CC' : '#5B3D00',
      border: '1px solid',
      borderColor: isDark ? '#D9A635' : '#E2B93B',
    };
  }

  if ([RequestStatus.WAITING_ON_TENANT, RequestStatus.WAITING_ON_VENDOR].includes(normalized)) {
    return {
      bgcolor: isDark ? '#8C3F35' : '#F7B0A8',
      color: isDark ? '#FFD9D4' : '#5C1E16',
      border: '1px solid',
      borderColor: isDark ? '#D78578' : '#D77E73',
    };
  }

  if (normalized === RequestStatus.COMPLETE) {
    return {
      bgcolor: isDark ? '#2F6F45' : '#B9E7C3',
      color: isDark ? '#D8F6DE' : '#133B1F',
      border: '1px solid',
      borderColor: isDark ? '#74C78D' : '#7BC68A',
    };
  }

  if (normalized === RequestStatus.CANCELLED) {
    return {
      bgcolor: isDark ? '#4A5160' : '#D7D9DE',
      color: isDark ? '#E5E7EB' : '#2E3440',
      border: '1px solid',
      borderColor: isDark ? '#8A92A3' : '#B4BAC5',
    };
  }

  return {
    bgcolor: 'transparent',
    color: 'text.primary',
    border: '1px solid',
    borderColor: 'divider',
  };
}
