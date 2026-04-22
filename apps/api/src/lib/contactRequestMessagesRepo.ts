import type { QueryResult } from './db.js';

export type ContactRequestMessageRow = {
  id: string;
  contact_request_id: string;
  author_user_id: string;
  body: string;
  is_internal_note: boolean;
  email_sent_at: string | null;
  email_provider_id: string | null;
  email_error: string | null;
  ai_suggested: boolean;
  ai_model: string | null;
  created_at: string;
  author_name?: string | null;
  author_email?: string | null;
};

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const MESSAGE_COLUMNS = `
  m.id,
  m.contact_request_id,
  m.author_user_id,
  m.body,
  m.is_internal_note,
  m.email_sent_at,
  m.email_provider_id,
  m.email_error,
  m.ai_suggested,
  m.ai_model,
  m.created_at,
  LTRIM(RTRIM(ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, ''))) AS author_name,
  u.email AS author_email
`;

export async function insertContactRequestMessage(
  db: Queryable,
  params: {
    contactRequestId: string;
    authorUserId: string;
    body: string;
    isInternalNote: boolean;
    aiSuggested: boolean;
    aiModel: string | null;
  }
): Promise<ContactRequestMessageRow> {
  const r = await db.query<ContactRequestMessageRow>(
    `INSERT INTO contact_request_messages
       (id, contact_request_id, author_user_id, body, is_internal_note, ai_suggested, ai_model)
     OUTPUT INSERTED.id, INSERTED.contact_request_id, INSERTED.author_user_id,
            INSERTED.body, INSERTED.is_internal_note,
            INSERTED.email_sent_at, INSERTED.email_provider_id, INSERTED.email_error,
            INSERTED.ai_suggested, INSERTED.ai_model, INSERTED.created_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6)`,
    [
      params.contactRequestId,
      params.authorUserId,
      params.body,
      params.isInternalNote ? 1 : 0,
      params.aiSuggested ? 1 : 0,
      params.aiModel,
    ]
  );
  if (!r.rows[0]) throw new Error('insert_contact_request_message_failed');
  return r.rows[0];
}

export async function updateContactRequestMessageEmailStatus(
  db: Queryable,
  id: string,
  params: { providerId: string | null; error: string | null }
): Promise<void> {
  await db.query(
    `UPDATE contact_request_messages
        SET email_sent_at = CASE WHEN $2 IS NULL THEN NULL ELSE SYSDATETIMEOFFSET() END,
            email_provider_id = $2,
            email_error = $3
      WHERE id = $1`,
    [id, params.providerId, params.error]
  );
}

export async function listContactRequestMessages(
  db: Queryable,
  contactRequestId: string
): Promise<ContactRequestMessageRow[]> {
  const r = await db.query<ContactRequestMessageRow>(
    `SELECT ${MESSAGE_COLUMNS}
       FROM contact_request_messages m
       LEFT JOIN users u ON u.id = m.author_user_id
      WHERE m.contact_request_id = $1
      ORDER BY m.created_at ASC`,
    [contactRequestId]
  );
  return r.rows;
}
