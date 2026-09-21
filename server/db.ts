import pg from "pg";
import { logger } from "./logger.js";
import type {
  User,
  PasswordResetToken,
  Person,
  FamilyUnit,
  FamilyChild,
  Family,
  FamilyMember,
  TreeShare,
  ActivityLog,
  ChatMessage,
} from "./store.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let isPostgresActive = false;

export function isDatabaseConnected(): boolean {
  return isPostgresActive;
}

export function getDatabasePool(): pg.Pool | null {
  return pool;
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
    return false;
  }

  try {
    const isLocalhost = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

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
    if (pool) {
      pool.end().catch(() => {});
      pool = null;
    }
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

    DROP TABLE IF EXISTS family_invitations;

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

    CREATE INDEX IF NOT EXISTS idx_people_owner ON people(owner_id);
    CREATE INDEX IF NOT EXISTS idx_units_owner ON family_units(owner_id);
    CREATE INDEX IF NOT EXISTS idx_children_unit ON family_children(family_unit_id);
    CREATE INDEX IF NOT EXISTS idx_activity_family ON activity_logs(family_id);
    CREATE INDEX IF NOT EXISTS idx_chat_family_user ON chat_messages(family_id, user_id);
  `;

  await client.query(schemaSql);

  // Auto-migrate newly introduced user profile columns if table already existed
  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS dob TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
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
      activitiesRes,
      chatsRes,
    ] = await Promise.all([
      pool.query<User>("SELECT * FROM users"),
      pool.query<PasswordResetToken>("SELECT * FROM password_reset_tokens"),
      pool.query<Family>("SELECT * FROM families"),
      pool.query<FamilyMember>("SELECT * FROM family_members"),
      pool.query<Person>("SELECT * FROM people"),
      pool.query<FamilyUnit>("SELECT * FROM family_units"),
      pool.query<FamilyChild>("SELECT * FROM family_children"),
      pool.query<TreeShare>("SELECT * FROM tree_shares"),
      pool.query<ActivityLog>("SELECT * FROM activity_logs ORDER BY created_at ASC"),
      pool.query<any>("SELECT * FROM chat_messages ORDER BY timestamp ASC"),
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
      activityLogs: activitiesRes.rows.map((a: any) => ({
        ...a,
        created_at: toIso(a.created_at),
      })),
      chatMessages: chatsRes.rows.map((m: any) => ({
        ...m,
        timestamp: toIso(m.timestamp),
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
    await pool.query(
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

export async function dbSaveResetToken(token: PasswordResetToken): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET used = EXCLUDED.used`,
      [token.id, token.user_id, token.token_hash, token.expires_at, token.used, token.created_at]
    );
  } catch (err) {
    logger.error("dbSaveResetToken error:", err);
  }
}

export async function dbSaveFamily(family: Family): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query(
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

export async function dbSaveFamilyMember(member: FamilyMember): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query(
      `INSERT INTO family_members (id, family_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (family_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [member.id, member.family_id, member.user_id, member.role, member.joined_at]
    );
  } catch (err) {
    logger.error("dbSaveFamilyMember error:", err);
  }
}

export async function dbDeleteFamilyMember(familyId: string, userId: string): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query("DELETE FROM family_members WHERE family_id = $1 AND user_id = $2", [familyId, userId]);
  } catch (err) {
    logger.error("dbDeleteFamilyMember error:", err);
  }
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
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query(
      `INSERT INTO tree_shares (id, family_id, owner_id, user_id, permission, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         permission = EXCLUDED.permission,
         updated_at = EXCLUDED.updated_at`,
      [share.id, share.family_id, share.owner_id, share.user_id, share.permission, share.created_at, share.updated_at]
    );
  } catch (err) {
    logger.error("dbSaveTreeShare error:", err);
  }
}

export async function dbDeleteTreeShare(shareId: string): Promise<void> {
  if (!pool || !isPostgresActive) return;
  try {
    await pool.query(`DELETE FROM tree_shares WHERE id = $1`, [shareId]);
  } catch (err) {
    logger.error("dbDeleteTreeShare error:", err);
  }
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
