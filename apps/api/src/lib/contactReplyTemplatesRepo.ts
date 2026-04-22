import type { QueryResult } from './db.js';

export type ContactReplyTemplateRow = {
  id: string;
  title: string;
  body: string;
  subject_scope: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type Queryable = { query<T>(sql: string, values?: unknown[]): Promise<QueryResult<T>> };

const TEMPLATE_COLUMNS = `id, title, body, subject_scope, created_by, created_at, updated_at`;

export async function listContactReplyTemplates(
  db: Queryable,
  opts?: { subjectScope?: string | null }
): Promise<ContactReplyTemplateRow[]> {
  if (opts?.subjectScope) {
    const r = await db.query<ContactReplyTemplateRow>(
      `SELECT ${TEMPLATE_COLUMNS}
         FROM contact_reply_templates
        WHERE subject_scope IS NULL OR subject_scope = $1
        ORDER BY title ASC`,
      [opts.subjectScope]
    );
    return r.rows;
  }
  const r = await db.query<ContactReplyTemplateRow>(
    `SELECT ${TEMPLATE_COLUMNS} FROM contact_reply_templates ORDER BY title ASC`
  );
  return r.rows;
}

export async function getContactReplyTemplateById(
  db: Queryable,
  id: string
): Promise<ContactReplyTemplateRow | null> {
  const r = await db.query<ContactReplyTemplateRow>(
    `SELECT ${TEMPLATE_COLUMNS} FROM contact_reply_templates WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function insertContactReplyTemplate(
  db: Queryable,
  params: {
    title: string;
    body: string;
    subjectScope: string | null;
    createdBy: string;
  }
): Promise<ContactReplyTemplateRow> {
  const r = await db.query<ContactReplyTemplateRow>(
    `INSERT INTO contact_reply_templates (id, title, body, subject_scope, created_by)
     OUTPUT INSERTED.id, INSERTED.title, INSERTED.body, INSERTED.subject_scope,
            INSERTED.created_by, INSERTED.created_at, INSERTED.updated_at
     VALUES (NEWID(), $1, $2, $3, $4)`,
    [params.title, params.body, params.subjectScope, params.createdBy]
  );
  if (!r.rows[0]) throw new Error('insert_contact_reply_template_failed');
  return r.rows[0];
}

export async function updateContactReplyTemplate(
  db: Queryable,
  id: string,
  params: { title: string; body: string; subjectScope: string | null }
): Promise<ContactReplyTemplateRow | null> {
  const r = await db.query<ContactReplyTemplateRow>(
    `UPDATE contact_reply_templates
        SET title = $2, body = $3, subject_scope = $4, updated_at = SYSDATETIMEOFFSET()
      OUTPUT INSERTED.id, INSERTED.title, INSERTED.body, INSERTED.subject_scope,
             INSERTED.created_by, INSERTED.created_at, INSERTED.updated_at
      WHERE id = $1`,
    [id, params.title, params.body, params.subjectScope]
  );
  return r.rows[0] ?? null;
}

export async function deleteContactReplyTemplate(
  db: Queryable,
  id: string
): Promise<boolean> {
  const r = await db.query<{ id: string }>(
    `DELETE FROM contact_reply_templates
     OUTPUT DELETED.id
     WHERE id = $1`,
    [id]
  );
  return Boolean(r.rows[0]?.id);
}
