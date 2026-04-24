/**
 * Calendar occupancy phase for lease UI (start/end vs today), matching Portal Tenants lease rows.
 * @param {string|Date|null|undefined} dateStr
 * @returns {string} YYYY-MM-DD or ''
 */
export function toDatePart(dateStr) {
  if (!dateStr) return '';
  // mssql DATE may JSON-serialize as full ISO; slice for comparisons and display.
  return String(dateStr).slice(0, 10);
}

/**
 * @param {{ start_date?: string, end_date?: string|null, month_to_month?: boolean } | null} lease
 * @returns {'active' | 'future' | 'expired'}
 */
export function getLeaseDisplayPhase(lease) {
  const today = new Date().toISOString().slice(0, 10);
  const start = lease?.start_date ? toDatePart(lease.start_date) : '';
  if (!start) return 'active';
  if (start > today) return 'future';
  const m2m = Boolean(lease.month_to_month);
  const endRaw = lease.end_date != null ? toDatePart(lease.end_date) : '';
  if (m2m || !endRaw) return 'active';
  if (endRaw < today) return 'expired';
  return 'active';
}
