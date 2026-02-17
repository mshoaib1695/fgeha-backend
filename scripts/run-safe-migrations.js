#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

function parseSqlStatements(sqlText) {
  const statements = [];
  let current = "";
  for (const rawLine of sqlText.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("--")) continue;
    current += rawLine + "\n";
    if (line.endsWith(";")) {
      const stmt = current.trim().replace(/;$/, "").trim();
      if (stmt) statements.push(stmt);
      current = "";
    }
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

const SKIPPABLE_CODES = new Set([
  "ER_DUP_FIELDNAME",
  "ER_DUP_KEYNAME",
  "ER_FK_DUP_NAME",
  "ER_TABLE_EXISTS_ERROR",
  "ER_CANT_DROP_FIELD_OR_KEY",
]);

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function hasMigrationRun(conn, filename) {
  const [rows] = await conn.query(
    "SELECT 1 FROM schema_migrations WHERE filename = ? LIMIT 1",
    [filename]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function markMigrationRun(conn, filename) {
  await conn.query(
    "INSERT INTO schema_migrations (filename) VALUES (?)",
    [filename]
  );
}

async function run() {
  const projectRoot = path.resolve(__dirname, "..");
  const migrationsDir = path.join(projectRoot, "migrations");
  loadEnvFile(path.join(projectRoot, ".env"));
  loadEnvFile(path.join(projectRoot, "src", ".env"));

  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USERNAME || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_DATABASE || "nest_crud";

  console.log(`Connecting to MySQL ${host}:${port}/${database} as ${user} ...`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: false,
  });

  try {
    await ensureMigrationsTable(conn);

    if (!fs.existsSync(migrationsDir)) {
      console.log("No migrations directory found. Nothing to run.");
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.toLowerCase().endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    if (files.length === 0) {
      console.log("No .sql migration files found. Nothing to run.");
      return;
    }

    for (const file of files) {
      const alreadyRun = await hasMigrationRun(conn, file);
      if (alreadyRun) {
        console.log(`Skipping ${file} (already executed).`);
        continue;
      }

      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, "utf8");
      const statements = parseSqlStatements(sql);
      console.log(`Running ${file} (${statements.length} statements) ...`);

      for (const statement of statements) {
        try {
          await conn.query(statement);
        } catch (err) {
          const code = err && err.code ? String(err.code) : "";
          if (SKIPPABLE_CODES.has(code)) {
            console.log(`  - Skipped safe duplicate/conflict (${code})`);
            continue;
          }
          throw err;
        }
      }

      await markMigrationRun(conn, file);
      console.log(`Completed ${file}`);
    }

    console.log("All migrations processed.");
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error("Migration run failed:", err?.message || err);
  process.exit(1);
});
