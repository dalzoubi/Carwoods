import { RequestStatus } from '../../domain/constants';

const STATUS_TO_TOKEN = {
    [RequestStatus.NOT_STARTED]: 'notStarted',
    [RequestStatus.ACKNOWLEDGED]: 'acknowledged',
    [RequestStatus.SCHEDULED]: 'acknowledged',
    [RequestStatus.WAITING_ON_TENANT]: 'waiting',
    [RequestStatus.WAITING_ON_VENDOR]: 'waiting',
    [RequestStatus.COMPLETE]: 'complete',
    [RequestStatus.CANCELLED]: 'cancelled',
};

export function getStatusChipSx(statusCode, theme) {
    const token = STATUS_TO_TOKEN[String(statusCode || '').toUpperCase()];
    const colors = token ? theme.palette.requestStatus?.[token] : null;
    if (!colors) {
        return {
            bgcolor: 'transparent',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'divider',
        };
    }
    return {
        bgcolor: colors.bg,
        color: colors.fg,
        border: '1px solid',
        borderColor: colors.border,
    };
}
