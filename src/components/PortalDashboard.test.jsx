import { describe, expect, it } from 'vitest';
import { countByStatus, statusColor } from './PortalDashboard';

describe('PortalDashboard status helpers', () => {
  it('counts statuses from status_code and excludes cancelled from open', () => {
    const counts = countByStatus([
      { status_code: 'OPEN', current_status_id: 'uuid-1' },
      { status_code: 'NOT_STARTED', current_status_id: 'uuid-2' },
      { status_code: 'ACKNOWLEDGED', current_status_id: 'uuid-3' },
      { status_code: 'IN_PROGRESS', current_status_id: 'uuid-4' },
      { status_code: 'CANCELLED', current_status_id: 'uuid-5' },
      { status_code: 'RESOLVED', current_status_id: 'uuid-6' },
      { status_code: 'CLOSED', current_status_id: 'uuid-7' },
    ]);

    expect(counts).toEqual({
      open: 3,
      inProgress: 1,
      resolved: 3,
    });
  });

  it('maps status chips to expected color buckets', () => {
    expect(statusColor('OPEN')).toBe('warning');
    expect(statusColor('NOT_STARTED')).toBe('warning');
    expect(statusColor('ACKNOWLEDGED')).toBe('warning');
    expect(statusColor('IN_PROGRESS')).toBe('info');
    expect(statusColor('CANCELLED')).toBe('success');
    expect(statusColor('RESOLVED')).toBe('success');
    expect(statusColor('CLOSED')).toBe('success');
    expect(statusColor('something_else')).toBe('default');
  });
});
