import pg from "pg";
import { logger } from "./logger.js";
import type {
  User,
  PasswordResetToken,
  PasswordResetOtp,
  Person,
  FamilyUnit,
  FamilyChild,
  Family,
  FamilyMember,
  TreeShare,
  ActivityLog,
  ChatMessage,
  FamilyInvitation,
} from "./store.js";

const { Pool } = pg;

declare global {
  // eslint-disable-next-line no-var
  var __rootline_pg_pool__: pg.Pool | undefined;
}

const isServerless =
  !!process.env.VERCEL ||
  !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NODE_ENV === "production";

export interface DeletedAccountRecord {
  id: string;
  email: string;
  deleted_at: string;
  cooldown_until: string;
}

let pool: pg.Pool | null = globalThis.__rootline_pg_pool__ || null;
let isPostgresActive = false;

export function isDatabaseConnected(): boolean {
  return isPostgresActive;
}

export function getDatabasePool(): pg.Pool | null {
  return pool;
}

function getSslConfig(databaseUrl: string) {
  const isLocalhost =
    databaseUrl.includes("localhost") ||
    databaseUrl.includes("127.0.0.1") ||
    databaseUrl.includes(".local");
  if (isLocalhost) {
    return false;
  }
  return { rejectUnauthorized: false };
}

export function createPgPool(databaseUrl: string): pg.Pool {
  if (globalThis.__rootline_pg_pool__) {
    return globalThis.__rootline_pg_pool__;
  }

  // Serverless environments (like Vercel) scale horizontally by spinning up multiple instances.
  // Using max: 2 prevents exhausting PostgreSQL max_connections while allowing concurrent ops.
  const maxConnections = process.env.DB_POOL_MAX
    ? parseInt(process.env.DB_POOL_MAX, 10)
    : isServerless
      ? 2
      : 10;

  // 10s connection timeout gives adequate headroom for serverless databases (e.g. Neon waking from pause)
  // without stalling requests indefinitely.
  const connectionTimeout = process.env.DB_CONNECTION_TIMEOUT_MS
    ? parseInt(process.env.DB_CONNECTION_TIMEOUT_MS, 10)
    : 10000;

  const newPool = new Pool({
    connectionString: databaseUrl,
    ssl: getSslConfig(databaseUrl),
    max: maxConnections,
    idleTimeoutMillis: isServerless ? 10000 : 30000,
    connectionTimeoutMillis: connectionTimeout,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

  newPool.on("error", (err: any) => {
    logger.warn("Unexpected error on idle PostgreSQL client:", err?.message || err);
  });

  globalThis.__rootline_pg_pool__ = newPool;
  return newPool;
}

export async function executeQuery<R extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<R>> {
  if (!pool) {
    throw new Error("PostgreSQL pool is not initialized.");
  }

  try {
    return await pool.query<R>(text, params);
  } catch (err: any) {
    const isConnErr =
      err?.code === "ECONNRESET" ||
      err?.code === "57P01" ||
      err?.code === "57P02" ||
      err?.code === "57P03" ||
      err?.code === "08006" ||
      err?.code === "08001" ||
      err?.message?.includes("Connection terminated") ||
      err?.message?.includes("timeout");

    if (isConnErr) {
      logger.warn(`PostgreSQL transient error (${err.message}). Retrying query once with fresh connection...`);
      return await pool.query<R>(text, params);
    }
    throw err;
  }
}

export async function checkDbHealth(): Promise<{ type: "postgres" | "memory"; connected: boolean; error?: string }> {
  if (!pool || !isPostgresActive) {
    return { type: "memory", connected: true };
  }
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return { type: "postgres", connected: true };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return { type: "postgres", connected: false, error: err.message };
  }
}

export async function initDatabase(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    logger.info("DATABASE_URL not set. Running with In-Memory Store.");
    isPostgresActive = false;
    return false;
  }

  if (pool && isPostgresActive) {
    return true;
  }

  try {
    pool = createPgPool(databaseUrl);

    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      logger.info("Successfully connected to PostgreSQL database.");
      await initSchema(client);
      isPostgresActive = true;
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    logger.error("Failed to connect to PostgreSQL database, falling back to In-Memory Store:", err);
    isPostgresActive = false;
    return false;
  }
}

async function initSchema(client: pg.PoolClient) {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      hashed_password TEXT,
      google_id TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TEXT NOT NULL,
      password_version INTEGER DEFAULT 1,
      photo_url TEXT,
      dob TEXT,
      phone TEXT,
      address TEXT,
      bio TEXT
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      verified BOOLEAN DEFAULT FALSE,
      reset_token VARCHAR(128) NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS families (
      id VARCHAR(64) PRIMARY KEY,
      owner_id VARCHAR(64) NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS family_members (
      id VARCHAR(64) PRIMARY KEY,
      family_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      role VARCHAR(32) NOT NULL,
      joined_at TEXT NOT NULL,
      UNIQUE(family_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS people (
      id VARCHAR(64) PRIMARY KEY,
      owner_id VARCHAR(64) NOT NULL,
      name TEXT NOT NULL,
      gender VARCHAR(32),
      date_of_birth TEXT,
      date_of_death TEXT,
      place_of_birth TEXT,
      occupation TEXT,
      bio TEXT,
      address TEXT,
      phone TEXT,
      photo_url TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS family_units (
      id VARCHAR(64) PRIMARY KEY,
      owner_id VARCHAR(64) NOT NULL,
      partner1_id VARCHAR(64),
      partner2_id VARCHAR(64),
      relationship_status VARCHAR(64),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS family_children (
      id VARCHAR(64) PRIMARY KEY,
      family_unit_id VARCHAR(64) NOT NULL,
      person_id VARCHAR(64) NOT NULL,
      relationship_type VARCHAR(64),
      UNIQUE(family_unit_id, person_id)
    );

    CREATE TABLE IF NOT EXISTS family_invitations (
      id VARCHAR(255) PRIMARY KEY,
      family_id VARCHAR(64) NOT NULL,
      family_name TEXT NOT NULL,
      inviter_id VARCHAR(64) NOT NULL,
      inviter_name TEXT NOT NULL,
      inviter_email TEXT NOT NULL,
      invitee_email TEXT NOT NULL,
      permission VARCHAR(32) NOT NULL DEFAULT 'viewer',
      token VARCHAR(128) NOT NULL UNIQUE,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      message TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      accepted_by_user_id VARCHAR(64)
    );

    CREATE INDEX IF NOT EXISTS idx_invitations_token ON family_invitations(token);
    CREATE INDEX IF NOT EXISTS idx_invitations_invitee ON family_invitations(invitee_email);
    CREATE INDEX IF NOT EXISTS idx_invitations_family ON family_invitations(family_id);

    CREATE TABLE IF NOT EXISTS tree_shares (
      id VARCHAR(64) PRIMARY KEY,
      family_id VARCHAR(64) NOT NULL,
      owner_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      permission VARCHAR(32) NOT NULL DEFAULT 'viewer',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(family_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_tree_shares_family ON tree_shares(family_id);
    CREATE INDEX IF NOT EXISTS idx_tree_shares_user ON tree_shares(user_id);

    CREATE TABLE IF NOT EXISTS activity_logs (
      id VARCHAR(64) PRIMARY KEY,
      family_id VARCHAR(64) NOT NULL,
      actor_id VARCHAR(64) NOT NULL,
      actor_name TEXT NOT NULL,
      action VARCHAR(64) NOT NULL,
      target_type VARCHAR(32) NOT NULL,
      target_id VARCHAR(64),
      target_name TEXT,
      description TEXT NOT NULL,
      details JSONB,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id VARCHAR(64) PRIMARY KEY,
      family_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      role VARCHAR(32) NOT NULL,
      content TEXT NOT NULL,
      provider VARCHAR(32),
      model VARCHAR(64),
      failover_occurred BOOLEAN DEFAULT FALSE,
      failover_details TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deleted_accounts (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      deleted_at TEXT NOT NULL,
      cooldown_until TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_people_owner ON people(owner_id);
    CREATE INDEX IF NOT EXISTS idx_units_owner ON family_units(owner_id);
    CREATE INDEX IF NOT EXISTS idx_children_unit ON family_children(family_unit_id);
    CREATE INDEX IF NOT EXISTS idx_activity_family ON activity_logs(family_id);
    CREATE INDEX IF NOT EXISTS idx_chat_family_user ON chat_messages(family_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_reset_otps_email ON password_reset_otps(email);
    CREATE INDEX IF NOT EXISTS idx_reset_otps_user ON password_reset_otps(user_id);
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON password_reset_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_deleted_accounts_email ON deleted_accounts(email);
  `;

  await client.query(schemaSql);

  // Auto-migrate newly introduced user profile columns if table already existed
  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS dob TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
    ALTER TABLE family_members ALTER COLUMN id TYPE VARCHAR(255);
    ALTER TABLE family_invitations ALTER COLUMN id TYPE VARCHAR(255);
  `);

  logger.info("PostgreSQL database tables and indexes verified.");
}

// Data loaders
export async function loadInitialData() {
  if (!pool || !isPostgresActive) return null;

  try {
    const [
      usersRes,
      tokensRes,
      familiesRes,
      membersRes,
      peopleRes,
      unitsRes,
      childrenRes,
      treeSharesRes,
      invitationsRes,
      activitiesRes,
      chatsRes,
      otpsRes,
      deletedAccountsRes,
    ] = await Promise.all([
      pool.query<User>("SELECT * FROM users"),
      pool.query<PasswordResetToken>("SELECT * FROM password_reset_tokens"),
      pool.query<Family>("SELECT * FROM families"),
      pool.query<FamilyMember>("SELECT * FROM family_members"),
      pool.query<Person>("SELECT * FROM people"),
      pool.query<FamilyUnit>("SELECT * FROM family_units"),
      pool.query<FamilyChild>("SELECT * FROM family_children"),
      pool.query<TreeShare>("SELECT * FROM tree_shares"),
      pool.query<FamilyInvitation>("SELECT * FROM family_invitations"),
      pool.query<ActivityLog>("SELECT * FROM activity_logs ORDER BY created_at ASC"),
      pool.query<any>("SELECT * FROM chat_messages ORDER BY timestamp ASC"),
      pool.query<PasswordResetOtp>("SELECT * FROM password_reset_otps").catch(() => ({ rows: [] as PasswordResetOtp[] })),
      pool.query<DeletedAccountRecord>("SELECT * FROM deleted_accounts WHERE cooldown_until > $1", [new Date().toISOString()]).catch(() => ({ rows: [] as DeletedAccountRecord[] })),
    ]);

    const toIso = (val: any) => {
      if (!val) return val;
      if (val instanceof Date) return val.toISOString();
      return typeof val === "string" ? val : String(val);
    };

    return {
      users: usersRes.rows.map((u: any) => ({
        ...u,
        created_at: toIso(u.created_at),
      })),
      resetTokens: tokensRes.rows.map((t: any) => ({
        ...t,
        created_at: toIso(t.created_at),
        expires_at: toIso(t.expires_at),
      })),
      families: familiesRes.rows.map((f: any) => ({
        ...f,
        created_at: toIso(f.created_at),
      })),
      familyMembers: membersRes.rows.map((m: any) => ({
        ...m,
        joined_at: toIso(m.joined_at),
      })),
      people: peopleRes.rows.map((p: any) => ({
        ...p,
        created_at: toIso(p.created_at),
      })),
      familyUnits: unitsRes.rows.map((u: any) => ({
        ...u,
        created_at: toIso(u.created_at),
      })),
      familyChildren: childrenRes.rows.map((c: any) => ({
        ...c,
        created_at: toIso(c.created_at),
      })),
      treeShares: treeSharesRes.rows.map((s: any) => ({
        ...s,
        created_at: toIso(s.created_at),
      })),
      invitations: invitationsRes.rows.map((inv: any) => ({
        ...inv,
        created_at: toIso(inv.created_at),
        expires_at: toIso(inv.expires_at),
        accepted_at: toIso(inv.accepted_at),
      })),
      activityLogs: activitiesRes.rows.map((a: any) => ({
        ...a,
        created_at: toIso(a.created_at),
      })),
      chatMessages: chatsRes.rows.map((m: any) => ({
        ...m,
        timestamp: toIso(m.timestamp),
      })),
      resetOtps: (otpsRes?.rows || []).map((o: any) => ({
        ...o,
        created_at: toIso(o.created_at),
        expires_at: toIso(o.expires_at),
      })),
      deletedAccounts: (deletedAccountsRes?.rows || []).map((d: any) => ({
        ...d,
        deleted_at: toIso(d.deleted_at),
        cooldown_until: toIso(d.cooldown_until),
      })),
    };
  } catch (err) {
    logger.error("Error loading initial data from PostgreSQL:", err);
    return null;
  }
}

// Write-through persistence handlers
export async function dbSaveUser(user: User): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await executeQuery(
      `INSERT INTO users (id, name, email, hashed_password, google_id, is_active, created_at, password_version, photo_url, dob, phone, address, bio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         hashed_password = EXCLUDED.hashed_password,
         google_id = EXCLUDED.google_id,
         is_active = EXCLUDED.is_active,
         password_version = EXCLUDED.password_version,
         photo_url = EXCLUDED.photo_url,
         dob = EXCLUDED.dob,
         phone = EXCLUDED.phone,
         address = EXCLUDED.address,
         bio = EXCLUDED.bio`,
      [
        user.id,
        user.name,
        user.email,
        user.hashed_password || null,
        user.google_id || null,
        user.is_active,
        user.created_at,
        user.password_version,
        user.photo_url || null,
        user.dob || null,
        user.phone || null,
        user.address || null,
        user.bio || null,
      ]
    );
  } catch (err) {
    logger.error("dbSaveUser error:", err);
  }
}

export async function dbFindUserById(id: string): Promise<User | null> {
  if (!pool || !isPostgresActive) return null;
  try {
    const res = await executeQuery<User>(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [id]);
    return res.rows[0] || null;
  } catch (err) {
    logger.error("dbFindUserById error:", err);
    return null;
  }
}

export async function dbFindUserByEmail(email: string): Promise<User | null> {
  if (!pool || !isPostgresActive) return null;
  try {
    const res = await executeQuery<User>(`SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email.trim()]);
    return res.rows[0] || null;
  } catch (err) {
    logger.error("dbFindUserByEmail error:", err);
    return null;
  }
}

export async function dbSaveDeletedAccount(record: DeletedAccountRecord): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await executeQuery(
      `INSERT INTO deleted_accounts (id, email, deleted_at, cooldown_until)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         deleted_at = EXCLUDED.deleted_at,
         cooldown_until = EXCLUDED.cooldown_until`,
      [record.id, record.email.toLowerCase().trim(), record.deleted_at, record.cooldown_until]
    );
  } catch (err) {
    logger.error("dbSaveDeletedAccount error:", err);
  }
}

export async function dbFindDeletedAccount(email: string): Promise<DeletedAccountRecord | null> {
  if (!pool || !isPostgresActive) return null;
  try {
    const res = await executeQuery<DeletedAccountRecord>(
      `SELECT * FROM deleted_accounts WHERE LOWER(email) = LOWER($1) AND cooldown_until > $2 ORDER BY deleted_at DESC LIMIT 1`,
      [email.trim(), new Date().toISOString()]
    );
    return res.rows[0] || null;
  } catch (err) {
    logger.error("dbFindDeletedAccount error:", err);
    return null;
  }
}

export async function dbDeleteExpiredDeletedAccount(email: string): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await executeQuery(`DELETE FROM deleted_accounts WHERE LOWER(email) = LOWER($1)`, [email.trim()]);
  } catch (err) {
    logger.error("dbDeleteExpiredDeletedAccount error:", err);
  }
}

export async function dbSaveResetToken(token: PasswordResetToken): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return; // In-memory development mode, persistence skipped
  }

  if (!pool || !isPostgresActive) {
    const connected = await initDatabase();
    if (!connected || !pool) {
      throw new Error("PostgreSQL database is configured but unavailable to persist reset token.");
    }
  }

  // Do NOT catch and swallow error here: let the caller know that persistence failed
  await executeQuery(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET used = EXCLUDED.used`,
    [token.id, token.user_id, token.token_hash, token.expires_at, token.used, token.created_at]
  );
}

export async function dbSaveResetOtp(otp: PasswordResetOtp): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return; // In-memory development mode, persistence skipped
  }

  if (!pool || !isPostgresActive) {
    const connected = await initDatabase();
    if (!connected || !pool) {
      throw new Error("PostgreSQL database is configured but unavailable to persist reset OTP.");
    }
  }

  // Do NOT catch and swallow error here: let the caller know that persistence failed
  await executeQuery(
    `INSERT INTO password_reset_otps (id, user_id, email, otp_hash, expires_at, attempts, max_attempts, verified, reset_token, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       expires_at = EXCLUDED.expires_at,
       attempts = EXCLUDED.attempts,
       verified = EXCLUDED.verified`,
    [
      otp.id,
      otp.user_id,
      otp.email,
      otp.otp_hash,
      otp.expires_at,
      otp.attempts,
      otp.max_attempts,
      otp.verified,
      otp.reset_token,
      otp.created_at,
    ]
  );
}

export async function dbFindResetOtpByEmail(email: string): Promise<PasswordResetOtp | null> {
  if (!pool || !isPostgresActive) return null;
  try {
    const res = await executeQuery<PasswordResetOtp>(
      `SELECT * FROM password_reset_otps WHERE email = $1 AND expires_at > $2 AND verified = FALSE ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase().trim(), new Date().toISOString()]
    );
    return res.rows[0] || null;
  } catch (err) {
    logger.error("dbFindResetOtpByEmail error:", err);
    return null;
  }
}

export async function dbFindResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | null> {
  if (!pool || !isPostgresActive) return null;
  try {
    const res = await executeQuery<PasswordResetToken>(
      `SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND used = FALSE AND expires_at > $2 LIMIT 1`,
      [tokenHash, new Date().toISOString()]
    );
    return res.rows[0] || null;
  } catch (err) {
    logger.error("dbFindResetTokenByHash error:", err);
    return null;
  }
}

export async function dbFindFamilyById(id: string): Promise<Family | null> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  if (!pool || !isPostgresActive) {
    const connected = await initDatabase();
    if (!connected || !pool) return null;
  }

  const res = await executeQuery<Family>("SELECT * FROM families WHERE id = $1 LIMIT 1", [id]);
  if (!res.rows[0]) return null;
  const f = res.rows[0];
  const createdAtVal = f.created_at;
  return {
    id: f.id,
    owner_id: f.owner_id,
    name: f.name,
    created_at:
      (createdAtVal as any) instanceof Date
        ? (createdAtVal as any).toISOString()
        : String(createdAtVal || new Date().toISOString()),
  };
}

export async function dbSaveFamily(family: Family): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await executeQuery(
      `INSERT INTO families (id, owner_id, name, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [family.id, family.owner_id, family.name, family.created_at]
    );
  } catch (err) {
    logger.error("dbSaveFamily error:", err);
  }
}

export async function dbDeleteFamily(familyId: string): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query("DELETE FROM tree_shares WHERE family_id = $1", [familyId]);
    await pool.query("DELETE FROM family_invitations WHERE family_id = $1", [familyId]);
    await pool.query("DELETE FROM family_members WHERE family_id = $1", [familyId]);
    await pool.query("DELETE FROM activity_logs WHERE family_id = $1", [familyId]);
    await pool.query("DELETE FROM chat_messages WHERE family_id = $1", [familyId]);
    await pool.query(
      "DELETE FROM family_children WHERE family_unit_id IN (SELECT id FROM family_units WHERE owner_id = $1)",
      [familyId]
    );
    await pool.query("DELETE FROM family_units WHERE owner_id = $1", [familyId]);
    await pool.query("DELETE FROM people WHERE owner_id = $1", [familyId]);
    await pool.query("DELETE FROM families WHERE id = $1", [familyId]);
  } catch (err) {
    logger.error("dbDeleteFamily error:", err);
  }
}

export async function dbDeleteUserAccount(userId: string, userEmail: string): Promise<void> {
  if (!pool || !isPostgresActive) return;
  const normalizedEmail = userEmail.toLowerCase().trim();
  try {
    // 1. Delete all data belonging to families owned by this user
    await pool.query(
      `DELETE FROM activity_logs 
       WHERE family_id IN (SELECT id FROM families WHERE owner_id = $1) 
          OR actor_id = $1`,
      [userId]
    );
    await pool.query(
      `DELETE FROM chat_messages 
       WHERE family_id IN (SELECT id FROM families WHERE owner_id = $1) 
          OR user_id = $1`,
      [userId]
    );
    await pool.query(
      `DELETE FROM family_invitations 
       WHERE family_id IN (SELECT id FROM families WHERE owner_id = $1) 
          OR inviter_id = $1 
          OR LOWER(invitee_email) = $2 
          OR accepted_by_user_id = $1`,
      [userId, normalizedEmail]
    );
    await pool.query(
      `DELETE FROM tree_shares 
       WHERE family_id IN (SELECT id FROM families WHERE owner_id = $1) 
          OR owner_id = $1 
          OR user_id = $1`,
      [userId]
    );
    await pool.query(
      `DELETE FROM family_members 
       WHERE family_id IN (SELECT id FROM families WHERE owner_id = $1) 
          OR user_id = $1`,
      [userId]
    );
    await pool.query(
      `DELETE FROM family_children 
       WHERE family_unit_id IN (
         SELECT id FROM family_units 
         WHERE owner_id IN (SELECT id FROM families WHERE owner_id = $1) 
            OR owner_id = $1
       )`,
      [userId]
    );
    await pool.query(
      `DELETE FROM family_units 
       WHERE owner_id IN (SELECT id FROM families WHERE owner_id = $1) 
          OR owner_id = $1`,
      [userId]
    );
    await pool.query(
      `DELETE FROM people 
       WHERE owner_id IN (SELECT id FROM families WHERE owner_id = $1) 
          OR owner_id = $1`,
      [userId]
    );
    await pool.query(`DELETE FROM families WHERE owner_id = $1`, [userId]);

    // 2. Delete user authentication and token records
    await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM password_reset_otps WHERE user_id = $1 OR LOWER(email) = $2`, [userId, normalizedEmail]);

    // 3. Delete user account
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    logger.info(`[DB] Successfully purged all tree data and user account for ${userId} (${normalizedEmail})`);
  } catch (err) {
    logger.error("dbDeleteUserAccount error:", err);
    throw err;
  }
}

export async function dbSaveFamilyMember(member: FamilyMember): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return;

  if (!pool || !isPostgresActive) {
    const connected = await initDatabase();
    if (!connected || !pool) {
      throw new Error("PostgreSQL database is configured but unavailable to save family member.");
    }
  }

  await executeQuery(
    `INSERT INTO family_members (id, family_id, user_id, role, joined_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (family_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [member.id, member.family_id, member.user_id, member.role, member.joined_at]
  );
}

export async function dbDeleteFamilyMember(familyId: string, userId: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return;

  if (!pool || !isPostgresActive) {
    const connected = await initDatabase();
    if (!connected || !pool) {
      throw new Error("PostgreSQL database is configured but unavailable to delete family member.");
    }
  }

  await executeQuery("DELETE FROM family_members WHERE family_id = $1 AND user_id = $2", [familyId, userId]);
}

export async function dbSavePerson(person: Person): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query(
      `INSERT INTO people (id, owner_id, name, gender, date_of_birth, date_of_death, place_of_birth, occupation, bio, address, phone, photo_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         gender = EXCLUDED.gender,
         date_of_birth = EXCLUDED.date_of_birth,
         date_of_death = EXCLUDED.date_of_death,
         place_of_birth = EXCLUDED.place_of_birth,
         occupation = EXCLUDED.occupation,
         bio = EXCLUDED.bio,
         address = EXCLUDED.address,
         phone = EXCLUDED.phone,
         photo_url = EXCLUDED.photo_url`,
      [
        person.id,
        person.owner_id,
        person.name,
        person.gender,
        person.date_of_birth,
        person.date_of_death,
        person.place_of_birth,
        person.occupation,
        person.bio,
        person.address,
        person.phone,
        person.photo_url,
        person.created_at,
      ]
    );
  } catch (err) {
    logger.error("dbSavePerson error:", err);
  }
}

export async function dbDeletePerson(personId: string): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query("DELETE FROM people WHERE id = $1", [personId]);
  } catch (err) {
    logger.error("dbDeletePerson error:", err);
  }
}

export async function dbSaveFamilyUnit(unit: FamilyUnit): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query(
      `INSERT INTO family_units (id, owner_id, partner1_id, partner2_id, relationship_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         partner1_id = EXCLUDED.partner1_id,
         partner2_id = EXCLUDED.partner2_id,
         relationship_status = EXCLUDED.relationship_status`,
      [unit.id, unit.owner_id, unit.partner1_id, unit.partner2_id, unit.relationship_status, unit.created_at]
    );
  } catch (err) {
    logger.error("dbSaveFamilyUnit error:", err);
  }
}

export async function dbDeleteFamilyUnit(unitId: string): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query("DELETE FROM family_units WHERE id = $1", [unitId]);
  } catch (err) {
    logger.error("dbDeleteFamilyUnit error:", err);
  }
}

export async function dbSaveFamilyChild(child: FamilyChild): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query(
      `INSERT INTO family_children (id, family_unit_id, person_id, relationship_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (family_unit_id, person_id) DO UPDATE SET relationship_type = EXCLUDED.relationship_type`,
      [child.id, child.family_unit_id, child.person_id, child.relationship_type]
    );
  } catch (err) {
    logger.error("dbSaveFamilyChild error:", err);
  }
}

export async function dbDeleteFamilyChild(childId: string): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query("DELETE FROM family_children WHERE id = $1", [childId]);
  } catch (err) {
    logger.error("dbDeleteFamilyChild error:", err);
  }
}

export async function dbSaveTreeShare(share: TreeShare): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return;

  if (!pool || !isPostgresActive) {
    const connected = await initDatabase();
    if (!connected || !pool) {
      throw new Error("PostgreSQL database is configured but unavailable to persist tree share.");
    }
  }

  await executeQuery(
    `INSERT INTO tree_shares (id, family_id, owner_id, user_id, permission, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (family_id, user_id) DO UPDATE SET
       permission = EXCLUDED.permission,
       updated_at = EXCLUDED.updated_at`,
    [share.id, share.family_id, share.owner_id, share.user_id, share.permission, share.created_at, share.updated_at]
  );
}

export async function dbDeleteTreeShare(shareId: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return;

  if (!pool || !isPostgresActive) {
    const connected = await initDatabase();
    if (!connected || !pool) {
      throw new Error("PostgreSQL database is configured but unavailable to delete tree share.");
    }
  }

  await executeQuery(`DELETE FROM tree_shares WHERE id = $1 OR user_id = $1`, [shareId]);
}

export async function dbDeleteTreeShareByUserAndFamily(familyId: string, userId: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return;

  if (!pool || !isPostgresActive) {
    const connected = await initDatabase();
    if (!connected || !pool) return;
  }

  await executeQuery(`DELETE FROM tree_shares WHERE family_id = $1 AND (user_id = $2 OR LOWER(user_id) = LOWER($2))`, [
    familyId,
    userId,
  ]);
}

export async function dbSaveActivityLog(log: ActivityLog): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query(
      `INSERT INTO activity_logs (id, family_id, actor_id, actor_name, action, target_type, target_id, target_name, description, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        log.id,
        log.family_id,
        log.actor_id,
        log.actor_name,
        log.action,
        log.target_type,
        log.target_id || null,
        log.target_name || null,
        log.description,
        log.details ? JSON.stringify(log.details) : null,
        log.created_at,
      ]
    );
  } catch (err) {
    logger.error("dbSaveActivityLog error:", err);
  }
}

export async function dbSaveChatMessage(msg: ChatMessage): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query(
      `INSERT INTO chat_messages (id, family_id, user_id, role, content, provider, model, failover_occurred, failover_details, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        msg.id,
        msg.family_id,
        msg.user_id,
        msg.role,
        msg.content,
        msg.provider || null,
        msg.model || null,
        msg.failoverOccurred || false,
        msg.failoverDetails || null,
        msg.timestamp,
      ]
    );
  } catch (err) {
    logger.error("dbSaveChatMessage error:", err);
  }
}

export async function dbSaveInvitation(invitation: FamilyInvitation): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return;

  if (!pool || !isPostgresActive) {
    const connected = await initDatabase();
    if (!connected || !pool) {
      throw new Error("PostgreSQL database is configured but unavailable to persist invitation.");
    }
  }

  await executeQuery(
    `INSERT INTO family_invitations (id, family_id, family_name, inviter_id, inviter_name, inviter_email, invitee_email, permission, token, status, message, created_at, expires_at, accepted_at, accepted_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       permission = EXCLUDED.permission,
       token = EXCLUDED.token,
       expires_at = EXCLUDED.expires_at,
       accepted_at = EXCLUDED.accepted_at,
       accepted_by_user_id = EXCLUDED.accepted_by_user_id`,
    [
      invitation.id,
      invitation.family_id,
      invitation.family_name,
      invitation.inviter_id,
      invitation.inviter_name,
      invitation.inviter_email,
      invitation.invitee_email,
      invitation.permission,
      invitation.token,
      invitation.status,
      invitation.message || null,
      invitation.created_at,
      invitation.expires_at,
      invitation.accepted_at || null,
      invitation.accepted_by_user_id || null,
    ]
  );
}

export async function dbDeleteInvitation(invitationId: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return;

  if (!pool || !isPostgresActive) {
    const connected = await initDatabase();
    if (!connected || !pool) {
      throw new Error("PostgreSQL database is configured but unavailable to delete invitation.");
    }
  }

  await executeQuery("DELETE FROM family_invitations WHERE id = $1", [invitationId]);
}

export async function dbUpdateInvitationStatus(
  invitationId: string,
  status: string,
  acceptedAt?: string,
  acceptedUserId?: string
): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return;

  if (!pool || !isPostgresActive) {
    const connected = await initDatabase();
    if (!connected || !pool) {
      throw new Error("PostgreSQL database is configured but unavailable to update invitation status.");
    }
  }

  await executeQuery(
    `UPDATE family_invitations
     SET status = $2, accepted_at = $3, accepted_by_user_id = $4
     WHERE id = $1`,
    [invitationId, status, acceptedAt || null, acceptedUserId || null]
  );
}

export async function dbGetPendingInvitationsForEmail(
  email: string,
  userId?: string
): Promise<FamilyInvitation[]> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl || !pool || !isPostgresActive) return [];

  try {
    const nowIso = new Date().toISOString();
    let query: string;
    let params: any[];

    if (userId) {
      query = `
        SELECT fi.* FROM family_invitations fi
        WHERE LOWER(fi.invitee_email) = LOWER($1)
          AND fi.status = 'pending'
          AND fi.expires_at > $2
          AND NOT EXISTS (
            SELECT 1 FROM tree_shares ts
            WHERE ts.family_id = fi.family_id AND ts.user_id = $3
          )
          AND NOT EXISTS (
            SELECT 1 FROM families f
            WHERE f.id = fi.family_id AND f.owner_id = $3
          )
        ORDER BY fi.created_at DESC
      `;
      params = [email.toLowerCase().trim(), nowIso, userId];
    } else {
      query = `
        SELECT fi.* FROM family_invitations fi
        WHERE LOWER(fi.invitee_email) = LOWER($1)
          AND fi.status = 'pending'
          AND fi.expires_at > $2
        ORDER BY fi.created_at DESC
      `;
      params = [email.toLowerCase().trim(), nowIso];
    }

    const res = await executeQuery<FamilyInvitation>(query, params);
    return res.rows;
  } catch (err) {
    logger.error("dbGetPendingInvitationsForEmail error:", err);
    return [];
  }
}

