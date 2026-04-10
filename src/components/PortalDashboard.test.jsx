import { describe, expect, it } from 'vitest';
import { countByStatus, priorityTone, statusColor } from './PortalDashboard';

describe('PortalDashboard status helpers', () => {
  it('counts statuses from status_code and excludes cancelled from open', () => {
    const counts = countByStatus([
      { status_code: 'NOT_STARTED', current_status_id: 'uuid-1' },
      { status_code: 'NOT_STARTED', current_status_id: 'uuid-2' },
      { status_code: 'ACKNOWLEDGED', current_status_id: 'uuid-3' },
      { status_code: 'SCHEDULED', current_status_id: 'uuid-4' },
      { status_code: 'WAITING_ON_VENDOR', current_status_id: 'uuid-5' },
      { status_code: 'CANCELLED', current_status_id: 'uuid-5' },
      { status_code: 'COMPLETE', current_status_id: 'uuid-6' },
    ]);

    expect(counts).toEqual({
      open: 3,
      inProgress: 2,
      resolved: 2,
    });
  });

  it('maps status chips to expected color buckets', () => {
    expect(statusColor('NOT_STARTED')).toBe('warning');
    expect(statusColor('ACKNOWLEDGED')).toBe('warning');
    expect(statusColor('SCHEDULED')).toBe('info');
    expect(statusColor('WAITING_ON_TENANT')).toBe('info');
    expect(statusColor('WAITING_ON_VENDOR')).toBe('info');
    expect(statusColor('CANCELLED')).toBe('success');
    expect(statusColor('COMPLETE')).toBe('success');
    expect(statusColor('something_else')).toBe('default');
  });

  it('maps request priority to expected color buckets', () => {
    expect(priorityTone({ priority_code: 'EMERGENCY' }).chipColor).toBe('error');
    expect(priorityTone({ priority_code: 'urgent' }).chipColor).toBe('warning');
    expect(priorityTone({ priority_name: 'Routine' }).chipColor).toBe('info');
    expect(priorityTone({ priority_code: 'unknown' }).chipColor).toBe('default');
  });
});
