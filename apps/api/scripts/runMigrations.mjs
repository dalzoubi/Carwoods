import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mssql from 'mssql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiDir, '..', '..');
const localSettingsPath = path.join(apiDir, 'local.settings.json');
const migrationsDir = path.join(repoRoot, 'infra', 'db', 'migrations');

function parseConnectionString(connectionString) {
  const parts = {};
  for (const segment of connectionString.split(';')) {
    const separatorIndex = segment.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = segment.slice(0, separatorIndex).trim().toLowerCase();
    const value = segment.slice(separatorIndex + 1).trim();
    if (key) parts[key] = value;
  }

  const server = parts.server ?? '';
  const [host, portRaw] = server.includes(',') ? server.split(',') : [server, '1433'];
  const port = Number.parseInt(portRaw || '1433', 10);

  return {
    server: host,
    port: Number.isNaN(port) ? 1433 : port,
    database: parts.database ?? parts['initial catalog'] ?? '',
    user: parts['user id'] ?? parts.uid ?? '',
    password: parts.password ?? parts.pwd ?? '',
    options: {
      encrypt: (parts.encrypt ?? 'yes').toLowerCase() !== 'no',
      trustServerCertificate: (parts.trustservercertificate ?? 'no').toLowerCase() === 'yes',
      enableArithAbort: true,
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 15_000,
    requestTimeout: 120_000,
  };
}

async function getDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }

  const localSettingsRaw = await fs.readFile(localSettingsPath, 'utf8');
  const localSettings = JSON.parse(localSettingsRaw);
  const fromLocalSettings = localSettings?.Values?.DATABASE_URL;
  if (typeof fromLocalSettings === 'string' && fromLocalSettings.trim()) {
    return fromLocalSettings.trim();
  }

  throw new Error('DATABASE_URL is not set in env or apps/api/local.settings.json');
}

async function getMigrationFiles() {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^[0-9]{3}_.+\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationsTable(pool) {
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.tables
      WHERE name = '__migrations' AND schema_id = SCHEMA_ID('dbo')
    )
    CREATE TABLE dbo.__migrations (
      name NVARCHAR(200) NOT NULL PRIMARY KEY,
      applied_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );
  `);
}

/** Single round-trip: avoids one SELECT per migration file on every run. */
async function loadAppliedMigrationNames(pool) {
  const result = await pool.request().query('SELECT name FROM dbo.__migrations;');
  const names = new Set();
  for (const row of result.recordset ?? []) {
    if (row?.name != null) names.add(String(row.name));
  }
  return names;
}

async function markMigrationApplied(pool, migrationName) {
  await pool
    .request()
    .input('name', mssql.NVarChar(200), migrationName)
    .query('INSERT INTO dbo.__migrations (name) VALUES (@name);');
}

/** SQL Server: columns added with ALTER TABLE are not visible to later statements in the same batch. */
function splitSqlBatches(sql) {
  return sql
    .split(/^\s*GO\s*$/gim)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

async function applyMigration(pool, fileName, appliedNames) {
  const migrationName = path.basename(fileName, '.sql');
  if (appliedNames.has(migrationName)) {
    console.log(`  ✓ ${migrationName} (already applied)`);
    return;
  }

  const migrationPath = path.join(migrationsDir, fileName);
  const sql = await fs.readFile(migrationPath, 'utf8');
  console.log(`  → Applying ${migrationName}`);
  const batches = splitSqlBatches(sql);
  for (const batch of batches) {
    await pool.request().batch(batch);
  }
  await markMigrationApplied(pool, migrationName);
  appliedNames.add(migrationName);
  console.log(`  ✓ ${migrationName} (done)`);
}

async function main() {
  const databaseUrl = await getDatabaseUrl();
  const config = parseConnectionString(databaseUrl);

  if (!config.server || !config.database || !config.user) {
    throw new Error('DATABASE_URL is missing one or more required fields (Server, Database, User Id).');
  }

  const migrationFiles = await getMigrationFiles();
  if (migrationFiles.length === 0) {
    throw new Error('No migration files found in infra/db/migrations.');
  }

  const pool = new mssql.ConnectionPool(config);
  await pool.connect();
  try {
    await ensureMigrationsTable(pool);
    const appliedNames = await loadAppliedMigrationNames(pool);
    console.log(`Applying migrations to ${config.server}/${config.database}`);
    for (const fileName of migrationFiles) {
      await applyMigration(pool, fileName, appliedNames);
    }
    console.log('Database migrations are up to date.');
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration runner failed: ${message}`);
  process.exitCode = 1;
});
