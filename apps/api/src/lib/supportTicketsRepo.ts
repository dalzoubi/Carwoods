import type { QueryResult } from './db.js';

export type SupportTicketCategory = 'BUG' | 'FEATURE' | 'QUESTION' | 'COMPLAINT';
export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type SupportTicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type SupportTicketAuthorRole = 'ADMIN' | 'LANDLORD' | 'TENANT' | 'AI_AGENT';

export type SupportTicketRow = {
  id: string;
  user_id: string;
  category: SupportTicketCategory;
  area: string | null;
  title: string;
  description_markdown: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority | null;
  assignee_user_id: string | null;
  diagnostics_json: string | null;
  last_activity_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportTicketMessageRow = {
  id: string;
  ticket_id: string;
  author_user_id: string;
  author_role: SupportTicketAuthorRole;
  body_markdown: string;
  is_internal_note: boolean;
  read_by_recipient_at: string | null;
  created_at: string;
};

export type SupportTicketAttachmentRow = {
  id: string;
  ticket_id: string;
  message_id: string | null;
  uploaded_by_user_id: string;
  storage_path: string;
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  finalized_at: string | null;
  created_at: string;
};

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const TICKET_COLUMNS = `id, user_id, category, area, title, description_markdown, status,
  priority, assignee_user_id, diagnostics_json, last_activity_at, resolved_at, closed_at,
  created_at, updated_at`;

const MESSAGE_COLUMNS = `id, ticket_id, author_user_id, author_role, body_markdown,
  is_internal_note, read_by_recipient_at, created_at`;

const ATTACHMENT_COLUMNS = `id, ticket_id, message_id, uploaded_by_user_id, storage_path,
  original_filename, content_type, file_size_bytes, finalized_at, created_at`;

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export async function insertSupportTicket(
  db: Queryable,
  params: {
    userId: string;
    category: SupportTicketCategory;
    area: string | null;
    title: string;
    descriptionMarkdown: string;
    diagnosticsJson: string | null;
  }
): Promise<SupportTicketRow> {
  const r = await db.query<SupportTicketRow>(
    `INSERT INTO support_tickets
       (id, user_id, category, area, title, description_markdown, diagnostics_json)
     OUTPUT INSERTED.id, INSERTED.user_id, INSERTED.category, INSERTED.area, INSERTED.title,
            INSERTED.description_markdown, INSERTED.status, INSERTED.priority,
            INSERTED.assignee_user_id, INSERTED.diagnostics_json, INSERTED.last_activity_at,
            INSERTED.resolved_at, INSERTED.closed_at, INSERTED.created_at, INSERTED.updated_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6)`,
    [
      params.userId,
      params.category,
      params.area,
      params.title,
      params.descriptionMarkdown,
      params.diagnosticsJson,
    ]
  );
  if (!r.rows[0]) throw new Error('insert_support_ticket_failed');
  return r.rows[0];
}

export async function getSupportTicketById(
  db: Queryable,
  id: string
): Promise<SupportTicketRow | null> {
  const r = await db.query<SupportTicketRow>(
    `SELECT ${TICKET_COLUMNS} FROM support_tickets WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function listSupportTicketsForUser(
  db: Queryable,
  userId: string,
  opts?: { status?: SupportTicketStatus; limit?: number; offset?: number }
): Promise<{ rows: SupportTicketRow[]; total: number }> {
  const { limit, offset } = safePaging(opts);
  const params: unknown[] = [userId];
  let where = `WHERE user_id = $1`;
  if (opts?.status) {
    params.push(opts.status);
    where += ` AND status = $2`;
  }
  const [countResult, rowResult] = await Promise.all([
    db.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM support_tickets ${where}`,
      [...params]
    ),
    db.query<SupportTicketRow>(
      `SELECT ${TICKET_COLUMNS} FROM support_tickets ${where}
       ORDER BY last_activity_at DESC
       OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
      [...params]
    ),
  ]);
  return { rows: rowResult.rows, total: Number(countResult.rows[0]?.total ?? 0) };
}

export async function listSupportTicketsForAdmin(
  db: Queryable,
  opts?: {
    status?: SupportTicketStatus;
    category?: SupportTicketCategory;
    area?: string;
    priority?: SupportTicketPriority;
    assigneeUserId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ rows: SupportTicketRow[]; total: number }> {
  const { limit, offset } = safePaging(opts);
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (opts?.status) {
    params.push(opts.status);
    clauses.push(`status = $${params.length}`);
  }
  if (opts?.category) {
    params.push(opts.category);
    clauses.push(`category = $${params.length}`);
  }
  if (opts?.area) {
    params.push(opts.area);
    clauses.push(`area = $${params.length}`);
  }
  if (opts?.priority) {
    params.push(opts.priority);
    clauses.push(`priority = $${params.length}`);
  }
  if (opts?.assigneeUserId) {
    params.push(opts.assigneeUserId);
    clauses.push(`assignee_user_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const [countResult, rowResult] = await Promise.all([
    db.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM support_tickets ${where}`,
      [...params]
    ),
    db.query<SupportTicketRow>(
      `SELECT ${TICKET_COLUMNS} FROM support_tickets ${where}
       ORDER BY last_activity_at DESC
       OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
      [...params]
    ),
  ]);
  return { rows: rowResult.rows, total: Number(countResult.rows[0]?.total ?? 0) };
}

export async function updateSupportTicketFields(
  db: Queryable,
  id: string,
  fields: {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority | null;
    assigneeUserId?: string | null;
    area?: string | null;
    category?: SupportTicketCategory;
  }
): Promise<SupportTicketRow | null> {
  const sets: string[] = ['updated_at = SYSDATETIMEOFFSET()', 'last_activity_at = SYSDATETIMEOFFSET()'];
  const params: unknown[] = [id];
  if (fields.status !== undefined) {
    params.push(fields.status);
    sets.push(`status = $${params.length}`);
    if (fields.status === 'RESOLVED') sets.push(`resolved_at = SYSDATETIMEOFFSET()`);
    if (fields.status === 'CLOSED') sets.push(`closed_at = SYSDATETIMEOFFSET()`);
    if (fields.status === 'OPEN' || fields.status === 'IN_PROGRESS') {
      sets.push(`resolved_at = NULL`);
      sets.push(`closed_at = NULL`);
    }
  }
  if (fields.priority !== undefined) {
    params.push(fields.priority);
    sets.push(`priority = $${params.length}`);
  }
  if (fields.assigneeUserId !== undefined) {
    params.push(fields.assigneeUserId);
    sets.push(`assignee_user_id = $${params.length}`);
  }
  if (fields.area !== undefined) {
    params.push(fields.area);
    sets.push(`area = $${params.length}`);
  }
  if (fields.category !== undefined) {
    params.push(fields.category);
    sets.push(`category = $${params.length}`);
  }
  const r = await db.query<SupportTicketRow>(
    `UPDATE support_tickets
     SET ${sets.join(', ')}
     OUTPUT INSERTED.id, INSERTED.user_id, INSERTED.category, INSERTED.area, INSERTED.title,
            INSERTED.description_markdown, INSERTED.status, INSERTED.priority,
            INSERTED.assignee_user_id, INSERTED.diagnostics_json, INSERTED.last_activity_at,
            INSERTED.resolved_at, INSERTED.closed_at, INSERTED.created_at, INSERTED.updated_at
     WHERE id = $1`,
    params
  );
  return r.rows[0] ?? null;
}

export async function touchSupportTicketActivity(db: Queryable, id: string): Promise<void> {
  await db.query(
    `UPDATE support_tickets
     SET last_activity_at = SYSDATETIMEOFFSET(), updated_at = SYSDATETIMEOFFSET()
     WHERE id = $1`,
    [id]
  );
}

// ---------------------------------------------------------------------------
// Status events (audit)
// ---------------------------------------------------------------------------

export async function insertStatusEvent(
  db: Queryable,
  params: {
    ticketId: string;
    actorUserId: string;
    fieldName: 'status' | 'priority' | 'assignee' | 'area' | 'category';
    fromValue: string | null;
    toValue: string | null;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO support_ticket_status_events
       (id, ticket_id, actor_user_id, field_name, from_value, to_value)
     VALUES (NEWID(), $1, $2, $3, $4, $5)`,
    [
      params.ticketId,
      params.actorUserId,
      params.fieldName,
      params.fromValue,
      params.toValue,
    ]
  );
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function insertSupportTicketMessage(
  db: Queryable,
  params: {
    ticketId: string;
    authorUserId: string;
    authorRole: SupportTicketAuthorRole;
    bodyMarkdown: string;
    isInternalNote: boolean;
  }
): Promise<SupportTicketMessageRow> {
  const r = await db.query<SupportTicketMessageRow>(
    `INSERT INTO support_ticket_messages
       (id, ticket_id, author_user_id, author_role, body_markdown, is_internal_note)
     OUTPUT INSERTED.id, INSERTED.ticket_id, INSERTED.author_user_id, INSERTED.author_role,
            INSERTED.body_markdown, INSERTED.is_internal_note,
            INSERTED.read_by_recipient_at, INSERTED.created_at
     VALUES (NEWID(), $1, $2, $3, $4, $5)`,
    [
      params.ticketId,
      params.authorUserId,
      params.authorRole,
      params.bodyMarkdown,
      params.isInternalNote ? 1 : 0,
    ]
  );
  if (!r.rows[0]) throw new Error('insert_support_ticket_message_failed');
  return r.rows[0];
}

export async function listSupportTicketMessages(
  db: Queryable,
  ticketId: string,
  opts?: { includeInternal?: boolean }
): Promise<SupportTicketMessageRow[]> {
  const whereInternal = opts?.includeInternal ? '' : ` AND is_internal_note = 0`;
  const r = await db.query<SupportTicketMessageRow>(
    `SELECT ${MESSAGE_COLUMNS} FROM support_ticket_messages
     WHERE ticket_id = $1 ${whereInternal}
     ORDER BY created_at ASC`,
    [ticketId]
  );
  return r.rows;
}

export async function markAllAdminRepliesReadForUser(
  db: Queryable,
  ticketId: string,
  userId: string
): Promise<number> {
  const r = await db.query<{ id: string }>(
    `UPDATE support_ticket_messages
     SET read_by_recipient_at = SYSDATETIMEOFFSET()
     OUTPUT INSERTED.id
     WHERE ticket_id = $1
       AND author_role = 'ADMIN'
       AND is_internal_note = 0
       AND read_by_recipient_at IS NULL
       AND EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = $1 AND t.user_id = $2)`,
    [ticketId, userId]
  );
  return r.rows.length;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export async function insertSupportTicketAttachmentIntent(
  db: Queryable,
  params: {
    ticketId: string;
    messageId: string | null;
    uploadedByUserId: string;
    storagePath: string;
    originalFilename: string;
    contentType: string;
    fileSizeBytes: number;
  }
): Promise<SupportTicketAttachmentRow> {
  const r = await db.query<SupportTicketAttachmentRow>(
    `INSERT INTO support_ticket_attachments
       (id, ticket_id, message_id, uploaded_by_user_id, storage_path,
        original_filename, content_type, file_size_bytes)
     OUTPUT INSERTED.id, INSERTED.ticket_id, INSERTED.message_id,
            INSERTED.uploaded_by_user_id, INSERTED.storage_path,
            INSERTED.original_filename, INSERTED.content_type,
            INSERTED.file_size_bytes, INSERTED.finalized_at, INSERTED.created_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7)`,
    [
      params.ticketId,
      params.messageId,
      params.uploadedByUserId,
      params.storagePath,
      params.originalFilename,
      params.contentType,
      params.fileSizeBytes,
    ]
  );
  if (!r.rows[0]) throw new Error('insert_support_ticket_attachment_failed');
  return r.rows[0];
}

export async function finalizeSupportTicketAttachment(
  db: Queryable,
  attachmentId: string
): Promise<SupportTicketAttachmentRow | null> {
  const r = await db.query<SupportTicketAttachmentRow>(
    `UPDATE support_ticket_attachments
     SET finalized_at = SYSDATETIMEOFFSET()
     OUTPUT INSERTED.id, INSERTED.ticket_id, INSERTED.message_id,
            INSERTED.uploaded_by_user_id, INSERTED.storage_path,
            INSERTED.original_filename, INSERTED.content_type,
            INSERTED.file_size_bytes, INSERTED.finalized_at, INSERTED.created_at
     WHERE id = $1`,
    [attachmentId]
  );
  return r.rows[0] ?? null;
}

export async function listSupportTicketAttachments(
  db: Queryable,
  ticketId: string
): Promise<SupportTicketAttachmentRow[]> {
  const r = await db.query<SupportTicketAttachmentRow>(
    `SELECT ${ATTACHMENT_COLUMNS} FROM support_ticket_attachments
     WHERE ticket_id = $1 AND finalized_at IS NOT NULL
     ORDER BY created_at ASC`,
    [ticketId]
  );
  return r.rows;
}

export async function getSupportTicketAttachmentById(
  db: Queryable,
  id: string
): Promise<SupportTicketAttachmentRow | null> {
  const r = await db.query<SupportTicketAttachmentRow>(
    `SELECT ${ATTACHMENT_COLUMNS} FROM support_ticket_attachments WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function countOpenTicketsForUser(
  db: Queryable,
  userId: string
): Promise<number> {
  const r = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM support_tickets
     WHERE user_id = $1 AND status IN ('OPEN', 'IN_PROGRESS')`,
    [userId]
  );
  return Number(r.rows[0]?.cnt ?? 0);
}

export async function countTicketsWithUnreadAdminReplyForUser(
  db: Queryable,
  userId: string
): Promise<number> {
  const r = await db.query<{ cnt: number }>(
    `SELECT COUNT(DISTINCT m.ticket_id) AS cnt
     FROM support_ticket_messages m
     INNER JOIN support_tickets t ON t.id = m.ticket_id
     WHERE t.user_id = $1
       AND m.author_role = 'ADMIN'
       AND m.is_internal_note = 0
       AND m.read_by_recipient_at IS NULL`,
    [userId]
  );
  return Number(r.rows[0]?.cnt ?? 0);
}

export async function countOpenTicketsForAdmin(db: Queryable): Promise<number> {
  const r = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM support_tickets WHERE status = 'OPEN'`
  );
  return Number(r.rows[0]?.cnt ?? 0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safePaging(opts?: { limit?: number; offset?: number }): { limit: number; offset: number } {
  const rawLimit = Math.trunc(Number(opts?.limit ?? 50));
  const rawOffset = Math.trunc(Number(opts?.offset ?? 0));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  return { limit, offset };
}
