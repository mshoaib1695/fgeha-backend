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

async function scalar(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) return 0;
  const firstKey = Object.keys(row)[0];
  return Number(row[firstKey] ?? 0);
}

async function hasColumn(conn, tableName, columnName) {
  const count = await scalar(
    conn,
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return count > 0;
}

async function hasIndex(conn, tableName, indexName) {
  const count = await scalar(
    conn,
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return count > 0;
}

async function hasForeignKey(conn, tableName, constraintName) {
  const count = await scalar(
    conn,
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [tableName, constraintName]
  );
  return count > 0;
}

async function ensureRequestsOptionColumn(conn) {
  const exists = await hasColumn(conn, "requests", "request_type_option_id");
  if (!exists) {
    console.log("Adding requests.request_type_option_id ...");
    await conn.query(
      "ALTER TABLE `requests` ADD COLUMN `request_type_option_id` INT NULL AFTER `request_type_id`"
    );
  } else {
    console.log("Column requests.request_type_option_id already exists, skipping.");
  }
}

async function ensureRequestsOptionIndex(conn) {
  const exists = await hasIndex(conn, "requests", "idx_requests_request_type_option_id");
  if (!exists) {
    console.log("Creating idx_requests_request_type_option_id ...");
    await conn.query(
      "CREATE INDEX `idx_requests_request_type_option_id` ON `requests` (`request_type_option_id`)"
    );
  } else {
    console.log("Index idx_requests_request_type_option_id already exists, skipping.");
  }
}

async function ensureRequestsOptionForeignKey(conn) {
  const exists = await hasForeignKey(
    conn,
    "requests",
    "fk_requests_request_type_option_id"
  );
  if (exists) {
    console.log("Foreign key fk_requests_request_type_option_id already exists, skipping.");
    return;
  }

  const hasCol = await hasColumn(conn, "requests", "request_type_option_id");
  if (!hasCol) {
    throw new Error(
      "Cannot add foreign key: requests.request_type_option_id does not exist."
    );
  }

  // Defensive cleanup in case this column already had orphan values.
  console.log("Cleaning orphan request_type_option_id values (if any) ...");
  await conn.query(
    `UPDATE \`requests\` r
     LEFT JOIN \`request_type_options\` o ON o.id = r.request_type_option_id
     SET r.request_type_option_id = NULL
     WHERE r.request_type_option_id IS NOT NULL
       AND o.id IS NULL`
  );

  console.log("Creating fk_requests_request_type_option_id ...");
  await conn.query(
    `ALTER TABLE \`requests\`
     ADD CONSTRAINT \`fk_requests_request_type_option_id\`
     FOREIGN KEY (\`request_type_option_id\`)
     REFERENCES \`request_type_options\` (\`id\`)
     ON DELETE SET NULL
     ON UPDATE CASCADE`
  );
}

async function ensureOptionNumberingColumns(conn) {
  const checks = [
    {
      table: "request_type_options",
      column: "request_number_prefix",
      ddl:
        "ALTER TABLE `request_type_options` ADD COLUMN `request_number_prefix` VARCHAR(20) NULL AFTER `option_type`",
    },
    {
      table: "request_type_options",
      column: "request_number_padding",
      ddl:
        "ALTER TABLE `request_type_options` ADD COLUMN `request_number_padding` INT NOT NULL DEFAULT 4 AFTER `request_number_prefix`",
    },
    {
      table: "request_type_options",
      column: "request_number_next",
      ddl:
        "ALTER TABLE `request_type_options` ADD COLUMN `request_number_next` INT NOT NULL DEFAULT 1 AFTER `request_number_padding`",
    },
  ];

  for (const item of checks) {
    const exists = await hasColumn(conn, item.table, item.column);
    if (!exists) {
      console.log(`Adding ${item.table}.${item.column} ...`);
      await conn.query(item.ddl);
    } else {
      console.log(`Column ${item.table}.${item.column} already exists, skipping.`);
    }
  }

  console.log("Normalizing numbering values on request_type_options ...");
  await conn.query(
    `UPDATE \`request_type_options\`
     SET
       \`request_number_padding\` = CASE
         WHEN \`request_number_padding\` IS NULL OR \`request_number_padding\` < 1 THEN 4
         WHEN \`request_number_padding\` > 12 THEN 12
         ELSE \`request_number_padding\`
       END,
       \`request_number_next\` = CASE
         WHEN \`request_number_next\` IS NULL OR \`request_number_next\` < 1 THEN 1
         ELSE \`request_number_next\`
       END`
  );
}

async function ensureRequestTypeNumberingColumnsRemoved(conn) {
  const obsoleteColumns = [
    "request_number_prefix",
    "request_number_padding",
    "request_number_next",
  ];
  for (const column of obsoleteColumns) {
    const exists = await hasColumn(conn, "request_types", column);
    if (!exists) {
      console.log(`Column request_types.${column} already removed, skipping.`);
      continue;
    }
    console.log(`Dropping request_types.${column} ...`);
    await conn.query(`ALTER TABLE \`request_types\` DROP COLUMN \`${column}\``);
  }
}

async function ensureUsersAccountStatusColumn(conn) {
  const exists = await hasColumn(conn, "users", "account_status");
  if (!exists) {
    console.log("Adding users.account_status ...");
    await conn.query(
      "ALTER TABLE `users` ADD COLUMN `account_status` ENUM('active','deactivated') NOT NULL DEFAULT 'active' AFTER `approvalStatus`"
    );
  } else {
    console.log("Column users.account_status already exists, skipping.");
  }
}

async function run() {
  const projectRoot = path.resolve(__dirname, "..");
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
    await ensureRequestsOptionColumn(conn);
    await ensureRequestsOptionIndex(conn);
    await ensureRequestsOptionForeignKey(conn);
    await ensureOptionNumberingColumns(conn);
    await ensureRequestTypeNumberingColumnsRemoved(conn);
    await ensureUsersAccountStatusColumn(conn);
    console.log("Migration completed safely. No duplicate schema changes were applied.");
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err?.message || err);
  process.exit(1);
});
