import type { QueryResult } from './db.js';

export type ContactRequestRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: 'UNREAD' | 'READ' | 'HANDLED';
  recaptcha_score: number | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
};

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const CONTACT_COLUMNS = `id, name, email, phone, subject, message, status, recaptcha_score, ip_address, created_at, updated_at`;

export async function insertContactRequest(
  db: Queryable,
  params: {
    name: string;
    email: string;
    phone: string | null;
    subject: string;
    message: string;
    recaptchaScore: number | null;
    ipAddress: string | null;
  }
): Promise<ContactRequestRow> {
  const r = await db.query<ContactRequestRow>(
    `INSERT INTO contact_requests (id, name, email, phone, subject, message, recaptcha_score, ip_address)
     OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.phone,
            INSERTED.subject, INSERTED.message, INSERTED.status,
            INSERTED.recaptcha_score, INSERTED.ip_address, INSERTED.created_at, INSERTED.updated_at
     VALUES (NEWID(), $1, $2, $3, $4, $5, $6, $7)`,
    [
      params.name,
      params.email,
      params.phone ?? null,
      params.subject,
      params.message,
      params.recaptchaScore ?? null,
      params.ipAddress ?? null,
    ]
  );
  if (!r.rows[0]) throw new Error('insert_contact_request_failed');
  return r.rows[0];
}

function safePaging(opts?: { limit?: number; offset?: number }): { limit: number; offset: number } {
  const rawLimit = Math.trunc(Number(opts?.limit ?? 50));
  const rawOffset = Math.trunc(Number(opts?.offset ?? 0));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  return { limit, offset };
}

export async function listContactRequests(
  db: Queryable,
  opts?: { status?: string; limit?: number; offset?: number }
): Promise<{ rows: ContactRequestRow[]; total: number }> {
  const { limit, offset } = safePaging(opts);
  const params: unknown[] = [];

  let whereClause = '';
  if (opts?.status) {
    params.push(opts.status);
    whereClause = `WHERE status = $1`;
  }

  // T-SQL requires integer row counts for OFFSET/FETCH; bound parameters can arrive as
  // non-integer types and fail ("must be an integer"). Use validated literals here.
  const [countResult, rowResult] = await Promise.all([
    db.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM contact_requests ${whereClause}`,
      [...params]
    ),
    db.query<ContactRequestRow>(
      `SELECT ${CONTACT_COLUMNS} FROM contact_requests ${whereClause}
       ORDER BY created_at DESC
       OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
      [...params]
    ),
  ]);

  return {
    rows: rowResult.rows,
    total: Number(countResult.rows[0]?.total ?? 0),
  };
}

export async function getContactRequestById(
  db: Queryable,
  id: string
): Promise<ContactRequestRow | null> {
  const r = await db.query<ContactRequestRow>(
    `SELECT ${CONTACT_COLUMNS} FROM contact_requests WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function setContactRequestStatus(
  db: Queryable,
  id: string,
  status: 'UNREAD' | 'READ' | 'HANDLED'
): Promise<ContactRequestRow | null> {
  const r = await db.query<ContactRequestRow>(
    `UPDATE contact_requests
     SET status = $2, updated_at = SYSDATETIMEOFFSET()
     OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.phone,
            INSERTED.subject, INSERTED.message, INSERTED.status,
            INSERTED.recaptcha_score, INSERTED.ip_address, INSERTED.created_at, INSERTED.updated_at
     WHERE id = $1`,
    [id, status]
  );
  return r.rows[0] ?? null;
}

export async function countUnreadContactRequests(db: Queryable): Promise<number> {
  const r = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM contact_requests WHERE status = 'UNREAD'`
  );
  return Number(r.rows[0]?.cnt ?? 0);
}

export async function deleteContactRequest(db: Queryable, id: string): Promise<boolean> {
  const r = await db.query<{ id: string }>(
    `DELETE FROM contact_requests
     OUTPUT DELETED.id
     WHERE id = $1`,
    [id]
  );
  return Boolean(r.rows[0]?.id);
}
