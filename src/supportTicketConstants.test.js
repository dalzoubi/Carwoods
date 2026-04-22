import { describe, expect, it } from 'vitest';
import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_AREAS,
  SUPPORT_TICKET_ALLOWED_MIME,
  SUPPORT_TICKET_MAX_ATTACHMENTS,
  SUPPORT_TICKET_MAX_ATTACHMENT_BYTES,
  isAllowedSupportTicketMime,
  formatSupportTicketFileSize,
} from './supportTicketConstants';

describe('supportTicketConstants', () => {
  it('lists all four categories', () => {
    expect(SUPPORT_TICKET_CATEGORIES).toEqual(['BUG', 'FEATURE', 'QUESTION', 'COMPLAINT']);
  });

  it('lists simple status flow', () => {
    expect(SUPPORT_TICKET_STATUSES).toEqual(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
  });

  it('includes OTHER area as the fallback', () => {
    expect(SUPPORT_TICKET_AREAS).toContain('OTHER');
  });

  it('caps attachments at 5 × 10 MB', () => {
    expect(SUPPORT_TICKET_MAX_ATTACHMENTS).toBe(5);
    expect(SUPPORT_TICKET_MAX_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024);
  });

  describe('isAllowedSupportTicketMime', () => {
    it('accepts image/png, pdf, text/plain', () => {
      expect(isAllowedSupportTicketMime('image/png')).toBe(true);
      expect(isAllowedSupportTicketMime('application/pdf')).toBe(true);
      expect(isAllowedSupportTicketMime('text/plain')).toBe(true);
    });

    it('rejects disallowed mime types', () => {
      expect(isAllowedSupportTicketMime('video/mp4')).toBe(false);
      expect(isAllowedSupportTicketMime('application/x-sh')).toBe(false);
      expect(isAllowedSupportTicketMime('')).toBe(false);
      expect(isAllowedSupportTicketMime(null)).toBe(false);
    });

    it('is case-insensitive on content type', () => {
      expect(isAllowedSupportTicketMime('IMAGE/PNG')).toBe(true);
    });

    it('matches declared allow-list exactly', () => {
      for (const mime of SUPPORT_TICKET_ALLOWED_MIME) {
        expect(isAllowedSupportTicketMime(mime)).toBe(true);
      }
    });
  });

  describe('formatSupportTicketFileSize', () => {
    it('formats bytes, KB, and MB', () => {
      expect(formatSupportTicketFileSize(512)).toBe('512 B');
      expect(formatSupportTicketFileSize(2048)).toBe('2.0 KB');
      expect(formatSupportTicketFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });

    it('returns empty for invalid sizes', () => {
      expect(formatSupportTicketFileSize(0)).toBe('');
      expect(formatSupportTicketFileSize(-1)).toBe('');
      expect(formatSupportTicketFileSize('huh')).toBe('');
    });
  });
});
