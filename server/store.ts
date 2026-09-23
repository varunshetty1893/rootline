import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  isDatabaseConnected,
  loadInitialData,
  dbSaveUser,
  dbFindUserById,
  dbFindUserByEmail,
  dbSaveDeletedAccount,
  dbFindDeletedAccount,
  dbDeleteExpiredDeletedAccount,
  type DeletedAccountRecord,
  dbSaveResetToken,
  dbSaveResetOtp,
  dbFindResetOtpByEmail,
  dbFindResetTokenByHash,
  dbSaveFamily,
  dbDeleteFamily,
  dbDeleteUserAccount,
  dbSaveFamilyMember,
  dbDeleteFamilyMember,
  dbSavePerson,
  dbDeletePerson,
  dbSaveFamilyUnit,
  dbDeleteFamilyUnit,
  dbSaveFamilyChild,
  dbDeleteFamilyChild,
  dbSaveTreeShare,
  dbDeleteTreeShare,
  dbSaveActivityLog,
  dbSaveChatMessage,
  dbSaveInvitation,
  dbDeleteInvitation,
  dbUpdateInvitationStatus,
  dbGetPendingInvitationsForEmail,
} from "./db.js";
import { logger } from "./logger.js";

const configuredBcryptRounds = Number.parseInt(process.env.BCRYPT_ROUNDS || (process.env.NODE_ENV === "test" ? "4" : "12"), 10);
const minRounds = process.env.NODE_ENV === "test" ? 4 : 12;
const BCRYPT_ROUNDS = Number.isInteger(configuredBcryptRounds) && configuredBcryptRounds >= minRounds && configuredBcryptRounds <= 15
  ? configuredBcryptRounds
  : (process.env.NODE_ENV === "test" ? 4 : 12);

export interface User {
  id: string;
  name: string;
  email: string;
  hashed_password?: string | null;
  google_id?: string | null;
  is_active: boolean;
  created_at: string;
  password_version: number;
  photo_url?: string | null;
  dob?: string | null;
  phone?: string | null;
  address?: string | null;
  bio?: string | null;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface PasswordResetOtp {
  id: string;
  user_id: string;
  email: string;
  otp_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  verified: boolean;
  reset_token: string;
  created_at: string;
}

export interface Person {
  id: string;
  owner_id: string;
  name: string;
  gender: string | null;
  date_of_birth: string | null;
  date_of_death: string | null;
  place_of_birth: string | null;
  occupation: string | null;
  bio: string | null;
  address: string | null;
  phone: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface FamilyChild {
  id: string;
  family_unit_id: string;
  person_id: string;
  relationship_type: string | null;
}

export interface FamilyUnit {
  id: string;
  owner_id: string;
  partner1_id: string | null;
  partner2_id: string | null;
  relationship_status: string | null;
  created_at: string;
}

export interface FamilyOption {
  id: string;
  partner_ids: string[];
  child_ids: string[];
  relationship_type: string | null;
  relationship_status: string | null;
}

export interface PersonOut {
  id: string;
  name: string;
  gender: string | null;
  date_of_birth: string | null;
  date_of_death: string | null;
  place_of_birth: string | null;
  occupation: string | null;
  bio: string | null;
  address: string | null;
  phone: string | null;
  photo_url: string | null;
  has_photo?: boolean;
  created_at: string;
  parent_ids: string[];
  spouse_ids: string[];
  parent_families: FamilyOption[];
  partner_families: FamilyOption[];
}

export type FamilyRole = "owner" | "editor" | "viewer";
export type SharePermission = "viewer" | "editor";

export interface Family {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: FamilyRole;
  joined_at: string;
}

export interface TreeShare {
  id: string;
  family_id: string;
  owner_id: string;
  user_id: string;
  permission: SharePermission;
  created_at: string;
  updated_at: string;
}

export type InvitationStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

export interface FamilyInvitation {
  id: string;
  family_id: string;
  family_name: string;
  inviter_id: string;
  inviter_name: string;
  inviter_email: string;
  invitee_email: string;
  permission: SharePermission;
  token: string;
  status: InvitationStatus;
  message?: string | null;
  created_at: string;
  expires_at: string;
  accepted_at?: string | null;
  accepted_by_user_id?: string | null;
}

export interface ChatMessage {
  id: string;
  family_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  provider?: "gemini" | "groq" | "rule_based_fallback";
  model?: string;
  failoverOccurred?: boolean;
  failoverDetails?: string;
  timestamp: string;
}

export type ActivityAction =
  | "PERSON_ADDED"
  | "PERSON_UPDATED"
  | "PERSON_DELETED"
  | "RELATIONSHIP_ADDED"
  | "RELATIONSHIP_UPDATED"
  | "RELATIONSHIP_REMOVED"
  | "FAMILY_CREATED"
  | "FAMILY_UPDATED"
  | "FAMILY_DELETED"
  | "TREE_SHARED"
  | "SHARE_UPDATED"
  | "SHARE_PERMISSION_CHANGED"
  | "SHARE_REMOVED"
  | "INVITATION_SENT"
  | "INVITATION_ACCEPTED"
  | "INVITATION_DECLINED"
  | "INVITATION_CANCELLED";

export interface ActivityLog {
  id: string;
  family_id: string;
  actor_id: string;
  actor_name: string;
  action: ActivityAction;
  target_type: "person" | "relationship" | "member" | "share" | "family" | "invitation";
  target_id?: string | null;
  target_name?: string | null;
  description: string;
  details?: Record<string, { before?: any; after?: any }> | null;
  created_at: string;
}

export interface PublicPersonOut {
  id: string;
  name: string;
  gender: string | null;
  date_of_birth: string | null;
  date_of_death: string | null;
  place_of_birth: string | null;
  occupation: string | null;
  photo_url: string | null;
  has_photo?: boolean;
  parent_ids: string[];
  spouse_ids: string[];
  parent_families: FamilyOption[];
  partner_families: FamilyOption[];
}

export interface FamilyStatistics {
  // CamelCase fields
  totalMembers: number;
  maleMembers: number;
  femaleMembers: number;
  otherGenderMembers: number;
  livingMembers: number;
  deceasedMembers: number;
  couplesCount: number;
  generationsCount: number;
  youngestMember: { id: string; name: string; dob: string; age?: number } | null;
  oldestLivingMember: { id: string; name: string; dob: string; age?: number } | null;
  averageAge: number | null;
  childrenCount: number;
  parentFamiliesCount: number;
  branchesCount: number;
  generationDistribution: { generation: number; count: number }[];

  // Snake_case fields expected by FamilyStatisticsModal
  total_people: number;
  living_count: number;
  deceased_count: number;
  max_generation_depth: number;
  total_couples: number;
  avg_children_per_family: number;
  avg_lifespan_years: number | null;
  gender_distribution: {
    male: number;
    female: number;
    other: number;
    unspecified: number;
  };
  top_surnames: { surname: string; count: number }[];
  oldest_ancestor: { id: string; name: string; date_of_birth: string; age?: number } | null;
  youngest_person: { id: string; name: string; date_of_birth: string; age?: number } | null;
}

export function normalizeToIsoString(dateVal: any): string {
  if (!dateVal) return "";
  if (typeof dateVal === "string") return dateVal;
  if (dateVal instanceof Date) return dateVal.toISOString();
  try {
    return new Date(dateVal).toISOString();
  } catch {
    return String(dateVal);
  }
}

export class MemoryStore {
  users: Map<string, User> = new Map();
  resetTokens: Map<string, PasswordResetToken> = new Map();
  resetOtps: Map<string, PasswordResetOtp> = new Map();
  people: Map<string, Person> = new Map();
  familyUnits: Map<string, FamilyUnit> = new Map();
  familyChildren: Map<string, FamilyChild> = new Map();

  families: Map<string, Family> = new Map();
  familyMembers: Map<string, FamilyMember> = new Map();
  treeShares: Map<string, TreeShare> = new Map();
  familyInvitations: Map<string, FamilyInvitation> = new Map();
  activityLogs: ActivityLog[] = [];
  chatHistories: Map<string, ChatMessage[]> = new Map(); // key: `${userId}:${familyId}`
  deletedAccounts: Map<string, DeletedAccountRecord> = new Map(); // key: lowercase email
  isDatabaseSynced = false;

  constructor() {
    // Seed demo accounts in in-memory mode or development (unless SEED_DEMO_DATA is explicitly false)
    const isProduction = process.env.NODE_ENV === "production";
    const explicitSeed = process.env.SEED_DEMO_DATA === "true";
    const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
    if (!hasDatabase && process.env.SEED_DEMO_DATA !== "false") {
      this.seedDemoData();
    } else if (!isProduction && process.env.SEED_DEMO_DATA !== "false") {
      this.seedDemoData();
    } else if (isProduction && explicitSeed) {
      this.seedDemoData();
    }
  }

  async initFromDatabase(): Promise<boolean> {
    const data = await loadInitialData();
    if (!data) return false;

    // Clear in-memory collections and populate from Postgres
    this.users.clear();
    this.resetTokens.clear();
    this.families.clear();
    this.familyMembers.clear();
    this.people.clear();
    this.familyUnits.clear();
    this.familyChildren.clear();
    this.treeShares.clear();
    this.familyInvitations.clear();
    this.activityLogs = [];
    this.chatHistories.clear();

    for (const u of data.users) {
      this.users.set(u.id, u);
    }
    for (const t of data.resetTokens) {
      this.resetTokens.set(t.id, t);
    }
    for (const f of data.families) {
      this.families.set(f.id, f);
    }
    for (const m of data.familyMembers) {
      this.familyMembers.set(m.id, m);
    }
    for (const p of data.people) {
      this.people.set(p.id, p);
    }
    for (const u of data.familyUnits) {
      this.familyUnits.set(u.id, u);
    }
    for (const c of data.familyChildren) {
      this.familyChildren.set(c.id, c);
    }
    for (const s of data.treeShares) {
      this.treeShares.set(s.id, s);
    }
    for (const inv of (data as any).invitations || []) {
      this.familyInvitations.set(inv.id, inv);
    }
    this.activityLogs = data.activityLogs || [];

    for (const msg of data.chatMessages || []) {
      const key = `${msg.user_id}:${msg.family_id}`;
      const list = this.chatHistories.get(key) || [];
      list.push(msg);
      this.chatHistories.set(key, list);
    }

    if ((data as any).resetOtps) {
      this.resetOtps.clear();
      for (const o of (data as any).resetOtps) {
        this.resetOtps.set(o.id, o);
      }
    }

    if ((data as any).deletedAccounts) {
      this.deletedAccounts.clear();
      const now = Date.now();
      for (const d of (data as any).deletedAccounts) {
        if (new Date(d.cooldown_until).getTime() > now) {
          this.deletedAccounts.set(d.email.toLowerCase().trim(), d);
        }
      }
    }
    this.isDatabaseSynced = true;

    // Only if database is completely brand new and empty AND not production, allow optional demo seed
    if (this.users.size === 0 && process.env.NODE_ENV !== "production" && process.env.SEED_DEMO_DATA === "true") {
      this.seedDemoData();
    }

    logger.info(`Initialized store from PostgreSQL (${this.users.size} users, ${this.people.size} people, ${this.families.size} families).`);
    return true;
  }

  // --- Deletion Cooldown & Protection ---
  isEmailInDeletionCooldown(email: string): {
    inCooldown: boolean;
    record?: DeletedAccountRecord;
    remainingMs?: number;
    cooldown_until?: string;
    deleted_at?: string;
  } {
    const normalized = email.toLowerCase().trim();
    const record = this.deletedAccounts.get(normalized);
    if (!record) return { inCooldown: false };

    const now = Date.now();
    const cooldownEnd = new Date(record.cooldown_until).getTime();
    if (now >= cooldownEnd) {
      this.deletedAccounts.delete(normalized);
      dbDeleteExpiredDeletedAccount(normalized).catch(() => {});
      return { inCooldown: false };
    }

    return {
      inCooldown: true,
      record,
      remainingMs: cooldownEnd - now,
      cooldown_until: record.cooldown_until,
      deleted_at: record.deleted_at,
    };
  }

  async isEmailInDeletionCooldownAsync(email: string): Promise<{
    inCooldown: boolean;
    record?: DeletedAccountRecord;
    remainingMs?: number;
    cooldown_until?: string;
    deleted_at?: string;
  }> {
    const local = this.isEmailInDeletionCooldown(email);
    if (local.inCooldown) return local;

    if (isDatabaseConnected()) {
      try {
        const dbRec = await dbFindDeletedAccount(email);
        if (dbRec) {
          const now = Date.now();
          const cooldownEnd = new Date(dbRec.cooldown_until).getTime();
          if (now < cooldownEnd) {
            this.deletedAccounts.set(dbRec.email.toLowerCase().trim(), dbRec);
            return {
              inCooldown: true,
              record: dbRec,
              remainingMs: cooldownEnd - now,
              cooldown_until: dbRec.cooldown_until,
              deleted_at: dbRec.deleted_at,
            };
          } else {
            await dbDeleteExpiredDeletedAccount(email);
          }
        }
      } catch (err) {
        logger.warn("Error checking deleted account in DB:", err);
      }
    }
    return { inCooldown: false };
  }

  // --- Users ---
  findUserByEmail(email: string): User | null {
    const normalized = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase().trim() === normalized) {
        return u;
      }
    }
    return null;
  }

  findUserById(id: string): User | null {
    return this.users.get(id) || null;
  }

  async findUserByIdAsync(id: string): Promise<User | null> {
    const existing = this.users.get(id);
    if (existing) return existing;
    if (isDatabaseConnected()) {
      const dbUser = await dbFindUserById(id);
      if (dbUser) {
        this.users.set(dbUser.id, dbUser);
        return dbUser;
      }
    }
    return null;
  }

  async findUserByEmailAsync(email: string): Promise<User | null> {
    const existing = this.findUserByEmail(email);
    if (existing) return existing;
    if (isDatabaseConnected()) {
      const dbUser = await dbFindUserByEmail(email);
      if (dbUser) {
        this.users.set(dbUser.id, dbUser);
        return dbUser;
      }
    }
    return null;
  }

  createUser(name: string, email: string, password?: string): User {
    const normalizedEmail = email.toLowerCase().trim();
    const cooldown = this.isEmailInDeletionCooldown(normalizedEmail);
    if (cooldown.inCooldown) {
      throw new Error(`This account was recently deleted. You cannot re-create an account with this email address for 24 hours (until ${cooldown.cooldown_until}).`);
    }

    const user: User = {
      id: crypto.randomUUID(),
      name,
      email: normalizedEmail,
      hashed_password: password ? bcrypt.hashSync(password, BCRYPT_ROUNDS) : null,
      google_id: null,
      is_active: true,
      created_at: new Date().toISOString(),
      password_version: 1,
    };
    this.users.set(user.id, user);
    dbSaveUser(user).catch((e) => logger.error("dbSaveUser error:", e));
    this.getOrCreateFamilyForUser(user);
    return user;
  }

  async createUserAsync(name: string, email: string, password?: string): Promise<User> {
    const normalizedEmail = email.toLowerCase().trim();
    const cooldown = await this.isEmailInDeletionCooldownAsync(normalizedEmail);
    if (cooldown.inCooldown) {
      throw new Error(`This account was recently deleted. You cannot re-create an account with this email address for 24 hours (until ${cooldown.cooldown_until}).`);
    }

    const user: User = {
      id: crypto.randomUUID(),
      name,
      email: normalizedEmail,
      hashed_password: password ? bcrypt.hashSync(password, BCRYPT_ROUNDS) : null,
      google_id: null,
      is_active: true,
      created_at: new Date().toISOString(),
      password_version: 1,
    };
    this.users.set(user.id, user);
    await dbSaveUser(user);
    await this.getOrCreateFamilyForUserAsync(user);
    return user;
  }

  updateUserPassword(userId: string, newPassword: string): User | null {
    const user = this.users.get(userId);
    if (!user) return null;
    user.hashed_password = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
    user.password_version += 1;
    dbSaveUser(user).catch((e) => logger.error("dbSaveUser error:", e));
    return user;
  }

  updateUserProfile(
    userId: string,
    updates: {
      name?: string;
      photo_url?: string | null;
      dob?: string | null;
      phone?: string | null;
      address?: string | null;
      bio?: string | null;
    }
  ): User | null {
    const user = this.users.get(userId);
    if (!user) return null;

    if (updates.name !== undefined && updates.name.trim()) {
      user.name = updates.name.trim();
    }
    if (updates.photo_url !== undefined) {
      user.photo_url = updates.photo_url;
    }
    if (updates.dob !== undefined) {
      user.dob = updates.dob ? updates.dob.trim() : null;
    }
    if (updates.phone !== undefined) {
      user.phone = updates.phone ? updates.phone.trim() : null;
    }
    if (updates.address !== undefined) {
      user.address = updates.address ? updates.address.trim() : null;
    }
    if (updates.bio !== undefined) {
      user.bio = updates.bio ? updates.bio.trim() : null;
    }

    dbSaveUser(user).catch((e) => logger.error("dbSaveUser error:", e));
    return user;
  }

  // --- Password Reset with Invalidation & Atomic Claim ---
  createResetToken(userId: string, rawToken: string, expireMinutes = 60): PasswordResetToken {
    // Invalidate all previous unexpired tokens for this user (Fixes Issue 12)
    for (const token of this.resetTokens.values()) {
      if (token.user_id === userId && !token.used) {
        token.used = true;
        dbSaveResetToken(token).catch((e) => logger.error("dbSaveResetToken error:", e));
      }
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000).toISOString();
    const row: PasswordResetToken = {
      id: crypto.randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used: false,
      created_at: new Date().toISOString(),
    };
    this.resetTokens.set(row.id, row);
    dbSaveResetToken(row).catch((e) => logger.error("dbSaveResetToken error:", e));
    return row;
  }

  // Atomic test-and-claim to prevent concurrency race conditions (Fixes Issue 11)
  claimResetToken(rawToken: string): PasswordResetToken | null {
    const submittedDigest = crypto.createHash("sha256").update(rawToken).digest("hex");
    const now = new Date().toISOString();
    for (const token of this.resetTokens.values()) {
      if (token.token_hash === submittedDigest && !token.used && token.expires_at > now) {
        token.used = true; // Atomically mark consumed
        dbSaveResetToken(token).catch((e) => logger.error("dbSaveResetToken error:", e));
        return token;
      }
    }
    return null;
  }

  async claimResetTokenAsync(rawToken: string): Promise<PasswordResetToken | null> {
    const claimed = this.claimResetToken(rawToken);
    if (claimed) {
      try {
        await dbSaveResetToken(claimed);
      } catch (err) {
        logger.error("Error persisting claimed reset token to DB:", err);
      }
      return claimed;
    }

    if (isDatabaseConnected()) {
      try {
        const submittedDigest = crypto.createHash("sha256").update(rawToken).digest("hex");
        const dbToken = await dbFindResetTokenByHash(submittedDigest);
        if (dbToken && !dbToken.used && dbToken.expires_at > new Date().toISOString()) {
          dbToken.used = true;
          this.resetTokens.set(dbToken.id, dbToken);
          await dbSaveResetToken(dbToken);
          return dbToken;
        }
      } catch (err) {
        logger.error("Error claiming reset token from DB:", err);
      }
    }
    return null;
  }

  // --- Browser Email OTP Generation & Verification (Option 1) ---
  createPasswordResetOtp(userId: string, email: string, rawOtp: string, expireMinutes = 15): PasswordResetOtp {
    const normalizedEmail = email.toLowerCase().trim();
    // Invalidate previous unexpired OTPs for this user
    for (const otp of this.resetOtps.values()) {
      if ((otp.user_id === userId || otp.email === normalizedEmail) && !otp.verified) {
        otp.expires_at = new Date(0).toISOString();
      }
    }

    const otpHash = crypto.createHash("sha256").update(rawOtp.trim()).digest("hex");
    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000).toISOString();
    const resetToken = crypto.randomBytes(32).toString("hex");

    const row: PasswordResetOtp = {
      id: crypto.randomUUID(),
      user_id: userId,
      email: normalizedEmail,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempts: 0,
      max_attempts: 5,
      verified: false,
      reset_token: resetToken,
      created_at: new Date().toISOString(),
    };

    this.resetOtps.set(row.id, row);
    // Also register the underlying resetToken so claimResetToken works once verified
    this.createResetToken(userId, resetToken, 30);

    return row;
  }

  async persistPasswordResetOtp(otpId: string): Promise<void> {
    const otp = this.resetOtps.get(otpId);
    if (!otp) {
      throw new Error("Password reset OTP record not found in memory store.");
    }

    const tokenHash = crypto.createHash("sha256").update(otp.reset_token).digest("hex");
    let tokenRow: PasswordResetToken | undefined;
    for (const t of this.resetTokens.values()) {
      if (t.token_hash === tokenHash) {
        tokenRow = t;
        break;
      }
    }

    const saves: Promise<void>[] = [];
    saves.push(dbSaveResetOtp(otp));
    if (tokenRow) {
      saves.push(dbSaveResetToken(tokenRow));
    }
    // Also persist any invalidated tokens or OTPs for this user
    for (const t of this.resetTokens.values()) {
      if (t.user_id === otp.user_id && t.used && t.id !== tokenRow?.id) {
        saves.push(dbSaveResetToken(t));
      }
    }
    for (const o of this.resetOtps.values()) {
      if (
        (o.user_id === otp.user_id || o.email === otp.email) &&
        o.id !== otp.id &&
        o.expires_at <= new Date().toISOString()
      ) {
        saves.push(dbSaveResetOtp(o));
      }
    }

    await Promise.all(saves);
  }

  verifyPasswordResetOtp(email: string, rawOtp: string): { success: boolean; reset_token?: string; error?: string } {
    const normalizedEmail = email.toLowerCase().trim();
    const cleanOtp = String(rawOtp || "").trim();
    const now = new Date().toISOString();

    let matchingOtp: PasswordResetOtp | null = null;
    for (const otp of this.resetOtps.values()) {
      if (otp.email === normalizedEmail && otp.expires_at > now && !otp.verified) {
        if (!matchingOtp || new Date(otp.created_at) > new Date(matchingOtp.created_at)) {
          matchingOtp = otp;
        }
      }
    }

    if (!matchingOtp) {
      return {
        success: false,
        error: "Verification code has expired or is invalid. Please request a new 6-digit code.",
      };
    }

    if (matchingOtp.attempts >= matchingOtp.max_attempts) {
      matchingOtp.expires_at = new Date(0).toISOString();
      dbSaveResetOtp(matchingOtp).catch((e) => logger.error("dbSaveResetOtp error:", e));
      return {
        success: false,
        error: "Too many incorrect attempts. For security reasons, please request a new verification code.",
      };
    }

    const submittedHash = crypto.createHash("sha256").update(cleanOtp).digest("hex");
    const isMatch = crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(matchingOtp.otp_hash));

    if (!isMatch) {
      matchingOtp.attempts += 1;
      dbSaveResetOtp(matchingOtp).catch((e) => logger.error("dbSaveResetOtp error:", e));
      const remaining = matchingOtp.max_attempts - matchingOtp.attempts;
      return {
        success: false,
        error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : "Please request a new code."}`,
      };
    }

    matchingOtp.verified = true;
    dbSaveResetOtp(matchingOtp).catch((e) => logger.error("dbSaveResetOtp error:", e));
    return {
      success: true,
      reset_token: matchingOtp.reset_token,
    };
  }

  async verifyPasswordResetOtpAsync(
    email: string,
    rawOtp: string
  ): Promise<{ success: boolean; reset_token?: string; error?: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    if (isDatabaseConnected()) {
      try {
        const dbOtp = await dbFindResetOtpByEmail(normalizedEmail);
        if (dbOtp && !this.resetOtps.has(dbOtp.id)) {
          this.resetOtps.set(dbOtp.id, dbOtp);
        }
      } catch (err) {
        logger.warn("Error looking up reset OTP in PostgreSQL:", err);
      }
    }
    return this.verifyPasswordResetOtp(normalizedEmail, rawOtp);
  }

  // --- Cycle Detection (Fixes Issue 10) ---
  // Returns true if `ancestorId` is already an ancestor of `descendantId`
  isAncestor(ancestorId: string, descendantId: string, visited = new Set<string>()): boolean {
    if (!ancestorId || !descendantId) return false;
    if (ancestorId === descendantId) return true;
    if (visited.has(descendantId)) return false;
    visited.add(descendantId);

    // Find all parent families of descendantId
    const childRows = Array.from(this.familyChildren.values()).filter(
      (fc) => fc.person_id === descendantId
    );

    for (const cr of childRows) {
      const fu = this.familyUnits.get(cr.family_unit_id);
      if (!fu) continue;

      for (const parentId of [fu.partner1_id, fu.partner2_id]) {
        if (parentId) {
          if (parentId === ancestorId) return true;
          if (this.isAncestor(ancestorId, parentId, visited)) return true;
        }
      }
    }
    return false;
  }

  saveFamilyUnit(fu: FamilyUnit): FamilyUnit {
    this.familyUnits.set(fu.id, fu);
    dbSaveFamilyUnit(fu).catch((e) => logger.error("dbSaveFamilyUnit error:", e));
    return fu;
  }

  // --- Database / Store Level Deduplication & Integrity for FamilyChild (Fixes Issues 8 & 35) ---
  addFamilyChild(
    familyUnitId: string,
    personId: string,
    relationshipType?: string | null
  ): FamilyChild {
    // Check if duplicate entry exists (Fixes Issue 8)
    const existing = Array.from(this.familyChildren.values()).find(
      (fc) => fc.family_unit_id === familyUnitId && fc.person_id === personId
    );

    if (existing) {
      if (relationshipType) {
        existing.relationship_type = relationshipType;
        dbSaveFamilyChild(existing).catch((e) => logger.error("dbSaveFamilyChild error:", e));
      }
      return existing;
    }

    // Database-level constraint: prevent self-parenting and ancestor-descendant cycle on direct store writes
    const fu = this.familyUnits.get(familyUnitId);
    if (fu) {
      if (fu.partner1_id === personId || fu.partner2_id === personId) {
        throw new Error("Cannot add child: person cannot be a parent to themselves");
      }
      for (const parentId of [fu.partner1_id, fu.partner2_id]) {
        if (parentId && this.isAncestor(personId, parentId)) {
          throw new Error("Cannot add child: would create a circular genealogical ancestor-descendant cycle");
        }
      }
    }

    const row: FamilyChild = {
      id: crypto.randomUUID(),
      family_unit_id: familyUnitId,
      person_id: personId,
      relationship_type: relationshipType || "unknown",
    };
    this.familyChildren.set(row.id, row);
    dbSaveFamilyChild(row).catch((e) => logger.error("dbSaveFamilyChild error:", e));
    return row;
  }

  // --- Relationships & Serialization ---
  private expandedPartnerIds(fu: FamilyUnit, spouseUnitsByPartner: Map<string, FamilyUnit[]>): string[] {
    const partnerIds: string[] = [];
    if (fu.partner1_id) partnerIds.push(fu.partner1_id);
    if (fu.partner2_id) partnerIds.push(fu.partner2_id);

    if (partnerIds.length !== 1) {
      return partnerIds;
    }

    const onlyPartner = partnerIds[0];
    const spouseUnits = spouseUnitsByPartner.get(onlyPartner) || [];
    const spouseIds = new Set<string>();
    for (const su of spouseUnits) {
      const other = su.partner1_id === onlyPartner ? su.partner2_id : su.partner1_id;
      if (other) {
        spouseIds.add(other);
      }
    }

    if (spouseIds.size === 1) {
      partnerIds.push(Array.from(spouseIds)[0]);
    }
    return partnerIds;
  }

  private familyOption(
    fu: FamilyUnit,
    spouseUnitsByPartner: Map<string, FamilyUnit[]>,
    childId?: string | null
  ): FamilyOption {
    const unitChildren = Array.from(this.familyChildren.values()).filter(
      (fc) => fc.family_unit_id === fu.id
    );
    const childRow = childId ? unitChildren.find((c) => c.person_id === childId) : null;
    const partnerIds = this.expandedPartnerIds(fu, spouseUnitsByPartner);

    return {
      id: fu.id,
      partner_ids: partnerIds,
      child_ids: unitChildren.map((c) => c.person_id),
      relationship_type: childRow ? childRow.relationship_type : null,
      relationship_status: fu.relationship_status,
    };
  }

  // Serializes person with optimized lightweight photo URL (Fixes Issues 5 & 6)
  serializePerson(person: Person, options?: { fullPhoto?: boolean }): PersonOut {
    const ownerUnits = Array.from(this.familyUnits.values()).filter(
      (fu) => fu.owner_id === person.owner_id
    );
    const spouseUnitsByPartner = new Map<string, FamilyUnit[]>();
    for (const fu of ownerUnits) {
      for (const pid of [fu.partner1_id, fu.partner2_id]) {
        if (pid) {
          if (!spouseUnitsByPartner.has(pid)) spouseUnitsByPartner.set(pid, []);
          spouseUnitsByPartner.get(pid)!.push(fu);
        }
      }
    }

    const childRows = Array.from(this.familyChildren.values()).filter(
      (fc) => fc.person_id === person.id
    );

    const parentFamilies: FamilyOption[] = [];
    const parentIdsList: string[] = [];

    for (const cr of childRows) {
      const fu = this.familyUnits.get(cr.family_unit_id);
      if (!fu) continue;
      parentFamilies.push(this.familyOption(fu, spouseUnitsByPartner, person.id));
      parentIdsList.push(...this.expandedPartnerIds(fu, spouseUnitsByPartner));
    }
    const parentIds = Array.from(new Set(parentIdsList));

    const spouseUnits = ownerUnits.filter(
      (fu) => fu.partner1_id === person.id || fu.partner2_id === person.id
    );
    const spouseIdsList: string[] = [];
    for (const fu of spouseUnits) {
      const other = fu.partner1_id === person.id ? fu.partner2_id : fu.partner1_id;
      if (other) spouseIdsList.push(other);
    }
    const spouseIds = Array.from(new Set(spouseIdsList));
    const partnerFamilies = spouseUnits.map((fu) => this.familyOption(fu, spouseUnitsByPartner));

    // Deliver photo via lightweight endpoint URL unless full base64 requested
    let resolvedPhotoUrl: string | null = null;
    if (person.photo_url) {
      if (options?.fullPhoto || person.photo_url.startsWith("http")) {
        resolvedPhotoUrl = person.photo_url;
      } else {
        resolvedPhotoUrl = `/people/${person.id}/photo`;
      }
    }

    return {
      id: person.id,
      name: person.name,
      gender: person.gender,
      date_of_birth: person.date_of_birth,
      date_of_death: person.date_of_death,
      place_of_birth: person.place_of_birth,
      occupation: person.occupation,
      bio: person.bio,
      address: person.address,
      phone: person.phone,
      photo_url: resolvedPhotoUrl,
      has_photo: !!person.photo_url,
      created_at: person.created_at,
      parent_ids: parentIds,
      spouse_ids: spouseIds,
      parent_families: parentFamilies,
      partner_families: partnerFamilies,
    };
  }

  getPeopleForOwner(ownerId: string, options?: { fullPhoto?: boolean }): PersonOut[] {
    const ownerPeople = Array.from(this.people.values()).filter((p) => p.owner_id === ownerId);
    ownerPeople.sort((a, b) => normalizeToIsoString(a.created_at).localeCompare(normalizeToIsoString(b.created_at)));

    return ownerPeople.map((person) => this.serializePerson(person, options));
  }

  getPeopleCount(ownerId: string): number {
    let count = 0;
    for (const p of this.people.values()) {
      if (p.owner_id === ownerId) count++;
    }
    return count;
  }

  getPerson(id: string, ownerId: string): Person | null {
    const p = this.people.get(id);
    if (!p || p.owner_id !== ownerId) return null;
    return p;
  }

  // --- Create Person & Wire Relationships ---
  createPerson(
    ownerId: string,
    data: {
      name: string;
      gender?: string | null;
      date_of_birth?: string | null;
      date_of_death?: string | null;
      place_of_birth?: string | null;
      occupation?: string | null;
      bio?: string | null;
      address?: string | null;
      phone?: string | null;
      photo_url?: string | null;
    },
    relation?: {
      relation_type?: string | null;
      related_to_id?: string | null;
      family_id?: string | null;
      partner_id?: string | null;
      family_relationship?: string | null;
      partner_status?: string | null;
      new_family?: boolean;
    },
    actor?: { id: string; name: string }
  ): PersonOut {
    // Validate birth and death dates (Fixes Issue 7)
    if (data.date_of_birth && data.date_of_death) {
      if (new Date(data.date_of_birth).getTime() > new Date(data.date_of_death).getTime()) {
        throw new Error("Date of death cannot be earlier than date of birth");
      }
    }

    const person: Person = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      name: data.name,
      gender: data.gender || null,
      date_of_birth: data.date_of_birth || null,
      date_of_death: data.date_of_death || null,
      place_of_birth: data.place_of_birth || null,
      occupation: data.occupation || null,
      bio: data.bio || null,
      address: data.address || null,
      phone: data.phone || null,
      photo_url: data.photo_url || null,
      created_at: new Date().toISOString(),
    };
    this.people.set(person.id, person);
    dbSavePerson(person).catch((e) => logger.error("dbSavePerson error:", e));

    if (relation?.relation_type && relation?.related_to_id) {
      this.applyRelation(person, relation, ownerId);
    }

    if (actor) {
      this.logActivity({
        family_id: ownerId,
        actor_id: actor.id,
        actor_name: actor.name,
        action: "PERSON_ADDED",
        target_type: "person",
        target_id: person.id,
        target_name: person.name,
        description: `${actor.name} added ${person.name} to the family tree`,
      });
    }

    return this.serializePerson(person);
  }

  private applyRelation(
    newPerson: Person,
    relation: {
      relation_type?: string | null;
      related_to_id?: string | null;
      family_id?: string | null;
      partner_id?: string | null;
      family_relationship?: string | null;
      partner_status?: string | null;
      new_family?: boolean;
    },
    ownerId: string
  ) {
    const related = this.getPerson(relation.related_to_id!, ownerId);
    if (!related) {
      throw new Error("The person you're relating to wasn't found");
    }

    let selectedFamily: FamilyUnit | null = null;
    if (relation.family_id) {
      selectedFamily = this.familyUnits.get(relation.family_id) || null;
      if (!selectedFamily || selectedFamily.owner_id !== ownerId) {
        throw new Error("The selected family was not found");
      }
    }

    let selectedPartner: Person | null = null;
    if (relation.partner_id) {
      selectedPartner = this.getPerson(relation.partner_id, ownerId);
      if (!selectedPartner) {
        throw new Error("The selected partner was not found");
      }
      if (selectedPartner.id === related.id) {
        throw new Error("A person cannot be their own partner");
      }
    }

    const validTypes = new Set([
      "father", "mother", "parent",
      "spouse", "partner", "husband", "wife",
      "child", "son", "daughter",
      "sibling", "brother", "sister"
    ]);

    const rawType = relation.relation_type?.toLowerCase() || "";
    if (!validTypes.has(rawType)) {
      throw new Error(`Invalid relationship type "${relation.relation_type}". Valid types are: parent, father, mother, child, son, daughter, spouse, partner, sibling.`);
    }

    const isParentType = rawType === "father" || rawType === "mother" || rawType === "parent";
    const isSpouseType = rawType === "spouse" || rawType === "partner" || rawType === "husband" || rawType === "wife";
    const isChildType = rawType === "child" || rawType === "son" || rawType === "daughter";
    const isSiblingType = rawType === "sibling" || rawType === "brother" || rawType === "sister";

    if (isParentType) {
      // Check cycle: making newPerson a parent of related (Fixes Issue 10)
      if (this.isAncestor(related.id, newPerson.id)) {
        throw new Error("Cannot create relationship: would create a circular genealogical ancestor-descendant cycle");
      }

      let fu: FamilyUnit;
      if (selectedFamily) {
        fu = selectedFamily;
        const relatedChild = Array.from(this.familyChildren.values()).find(
          (c) => c.family_unit_id === fu.id && c.person_id === related.id
        );
        if (!relatedChild) {
          throw new Error("That family does not belong to the selected person");
        }
        if (relation.family_relationship && !relatedChild.relationship_type) {
          relatedChild.relationship_type = relation.family_relationship;
        }
      } else if (!relation.new_family) {
        const childRows = Array.from(this.familyChildren.values()).filter(
          (c) => c.person_id === related.id
        );
        if (childRows.length > 1) {
          throw new Error("This person has multiple parent families. Choose the family explicitly.");
        }
        if (childRows.length === 1) {
          fu = this.familyUnits.get(childRows[0].family_unit_id)!;
        } else {
          fu = {
            id: crypto.randomUUID(),
            owner_id: ownerId,
            partner1_id: null,
            partner2_id: null,
            relationship_status: null,
            created_at: new Date().toISOString(),
          };
          this.saveFamilyUnit(fu);
          this.addFamilyChild(fu.id, related.id, relation.family_relationship || "unknown");
        }
      } else {
        fu = {
          id: crypto.randomUUID(),
          owner_id: ownerId,
          partner1_id: null,
          partner2_id: null,
          relationship_status: null,
          created_at: new Date().toISOString(),
        };
        this.saveFamilyUnit(fu);
        this.addFamilyChild(fu.id, related.id, relation.family_relationship || "unknown");
      }

      if (fu.partner1_id === null) {
        fu.partner1_id = newPerson.id;
      } else if (fu.partner2_id === null) {
        fu.partner2_id = newPerson.id;
      } else {
        throw new Error(`${related.name} already has two parents recorded`);
      }
      this.saveFamilyUnit(fu);
    } else if (isSpouseType) {
      // Prevent direct ancestor and descendant from being linked as partners (Fixes Issue 35)
      if (this.isAncestor(newPerson.id, related.id) || this.isAncestor(related.id, newPerson.id)) {
        throw new Error("Cannot create relationship: direct ancestor and descendant cannot be linked as partners");
      }

      // Prevent duplicate spouse family units (Fixes Issue 9)
      const existingSpouseUnit = Array.from(this.familyUnits.values()).find(
        (fu) =>
          fu.owner_id === ownerId &&
          ((fu.partner1_id === related.id && fu.partner2_id === newPerson.id) ||
            (fu.partner1_id === newPerson.id && fu.partner2_id === related.id))
      );

      if (existingSpouseUnit) {
        if (relation.partner_status) {
          existingSpouseUnit.relationship_status = relation.partner_status;
          this.saveFamilyUnit(existingSpouseUnit);
        }
        return;
      }

      // Check if related has a single-partner unit that can be completed
      const singleUnit = Array.from(this.familyUnits.values()).find(
        (fu) =>
          fu.owner_id === ownerId &&
          ((fu.partner1_id === related.id && fu.partner2_id === null) ||
            (fu.partner2_id === related.id && fu.partner1_id === null))
      );

      if (singleUnit) {
        if (singleUnit.partner1_id === related.id) {
          singleUnit.partner2_id = newPerson.id;
        } else {
          singleUnit.partner1_id = newPerson.id;
        }
        if (relation.partner_status) {
          singleUnit.relationship_status = relation.partner_status;
        }
        this.saveFamilyUnit(singleUnit);
        return;
      }

      const fu: FamilyUnit = {
        id: crypto.randomUUID(),
        owner_id: ownerId,
        partner1_id: related.id,
        partner2_id: newPerson.id,
        relationship_status: relation.partner_status || "partner",
        created_at: new Date().toISOString(),
      };
      this.saveFamilyUnit(fu);
    } else if (isChildType) {
      // Check cycle: making newPerson a child of related (Fixes Issue 10)
      if (this.isAncestor(newPerson.id, related.id)) {
        throw new Error("Cannot create relationship: would create a circular genealogical ancestor-descendant cycle");
      }

      let fu: FamilyUnit | null = selectedFamily;
      if (fu && fu.partner1_id !== related.id && fu.partner2_id !== related.id) {
        throw new Error("That family does not belong to the selected person");
      }
      if (!fu && selectedPartner) {
        fu = {
          id: crypto.randomUUID(),
          owner_id: ownerId,
          partner1_id: related.id,
          partner2_id: selectedPartner.id,
          relationship_status: relation.partner_status || "partner",
          created_at: new Date().toISOString(),
        };
        this.saveFamilyUnit(fu);
      }
      if (!fu) {
        const partnerFamilies = Array.from(this.familyUnits.values()).filter(
          (f) =>
            f.owner_id === ownerId &&
            (f.partner1_id === related.id || f.partner2_id === related.id)
        );
        partnerFamilies.sort((a, b) => normalizeToIsoString(a.created_at).localeCompare(normalizeToIsoString(b.created_at)));
        const complete = partnerFamilies.filter((f) => f.partner1_id && f.partner2_id);
        if (complete.length === 1) {
          fu = complete[0];
        } else {
          fu = {
            id: crypto.randomUUID(),
            owner_id: ownerId,
            partner1_id: related.id,
            partner2_id: null,
            relationship_status: relation.partner_status || "partner",
            created_at: new Date().toISOString(),
          };
          this.saveFamilyUnit(fu);
        }
      }

      // Add child with deduplication check (Fixes Issue 8)
      this.addFamilyChild(fu.id, newPerson.id, relation.family_relationship || "unknown");
    } else if (isSiblingType) {
      let fu: FamilyUnit;
      if (selectedFamily) {
        fu = selectedFamily;
        const isChild = Array.from(this.familyChildren.values()).some(
          (c) => c.family_unit_id === fu.id && c.person_id === related.id
        );
        if (!isChild) {
          throw new Error("That family does not belong to the selected person");
        }
      } else if (!relation.new_family) {
        const childRows = Array.from(this.familyChildren.values()).filter(
          (c) => c.person_id === related.id
        );
        if (childRows.length > 1) {
          throw new Error("This person belongs to multiple parent families. Choose the family explicitly.");
        }
        if (childRows.length === 1) {
          fu = this.familyUnits.get(childRows[0].family_unit_id)!;
        } else {
          fu = {
            id: crypto.randomUUID(),
            owner_id: ownerId,
            partner1_id: null,
            partner2_id: null,
            relationship_status: null,
            created_at: new Date().toISOString(),
          };
          this.saveFamilyUnit(fu);
          this.addFamilyChild(fu.id, related.id, relation.family_relationship || "unknown");
        }
      } else {
        fu = {
          id: crypto.randomUUID(),
          owner_id: ownerId,
          partner1_id: null,
          partner2_id: null,
          relationship_status: null,
          created_at: new Date().toISOString(),
        };
        this.saveFamilyUnit(fu);
        this.addFamilyChild(fu.id, related.id, relation.family_relationship || "unknown");
      }

      // Add sibling with deduplication check (Fixes Issue 8)
      this.addFamilyChild(fu.id, newPerson.id, relation.family_relationship || "unknown");
    }
  }

  // --- Link People ---
  linkPeople(
    ownerId: string,
    firstPersonId: string,
    secondPersonId: string,
    relationshipStatus = "partner",
    actor?: { id: string; name: string }
  ): { message: string } {
    if (firstPersonId === secondPersonId) {
      throw new Error("A person cannot be linked to themself");
    }
    const p1 = this.getPerson(firstPersonId, ownerId);
    const p2 = this.getPerson(secondPersonId, ownerId);
    if (!p1 || !p2) {
      throw new Error("One of the people was not found");
    }

    // Direct ancestor and descendant cannot be linked as partners (Fixes Issue 35)
    if (this.isAncestor(firstPersonId, secondPersonId) || this.isAncestor(secondPersonId, firstPersonId)) {
      throw new Error("Cannot link people: direct ancestor and descendant cannot be linked as partners");
    }

    const existing = Array.from(this.familyUnits.values()).find(
      (fu) =>
        fu.owner_id === ownerId &&
        ((fu.partner1_id === firstPersonId && fu.partner2_id === secondPersonId) ||
          (fu.partner1_id === secondPersonId && fu.partner2_id === firstPersonId))
    );

    if (existing) {
      if (relationshipStatus) existing.relationship_status = relationshipStatus;
      return { message: "People are already linked." };
    }

    const candidateUnits = Array.from(this.familyUnits.values()).filter(
      (fu) =>
        fu.owner_id === ownerId &&
        (fu.partner1_id === firstPersonId ||
          fu.partner1_id === secondPersonId ||
          fu.partner2_id === firstPersonId ||
          fu.partner2_id === secondPersonId)
    );

    candidateUnits.sort((a, b) => {
      const aChildren = Array.from(this.familyChildren.values()).filter((c) => c.family_unit_id === a.id).length;
      const bChildren = Array.from(this.familyChildren.values()).filter((c) => c.family_unit_id === b.id).length;
      if (bChildren !== aChildren) return bChildren - aChildren;
      const aMissing = a.partner1_id === null || a.partner2_id === null ? 0 : 1;
      const bMissing = b.partner1_id === null || b.partner2_id === null ? 0 : 1;
      if (aMissing !== bMissing) return aMissing - bMissing;
      return normalizeToIsoString(a.created_at).localeCompare(normalizeToIsoString(b.created_at));
    });

    for (const family of candidateUnits) {
      if (family.partner1_id === firstPersonId && family.partner2_id === null) {
        family.partner2_id = secondPersonId;
        family.relationship_status = relationshipStatus || family.relationship_status || "partner";
        this.saveFamilyUnit(family);
        if (actor) {
          this.logActivity({
            family_id: ownerId,
            actor_id: actor.id,
            actor_name: actor.name,
            action: "RELATIONSHIP_ADDED",
            target_type: "relationship",
            description: `${actor.name} linked ${p1.name} and ${p2.name}`,
          });
        }
        return { message: "People linked." };
      }
      if (family.partner1_id === secondPersonId && family.partner2_id === null) {
        family.partner2_id = firstPersonId;
        family.relationship_status = relationshipStatus || family.relationship_status || "partner";
        this.saveFamilyUnit(family);
        if (actor) {
          this.logActivity({
            family_id: ownerId,
            actor_id: actor.id,
            actor_name: actor.name,
            action: "RELATIONSHIP_ADDED",
            target_type: "relationship",
            description: `${actor.name} linked ${p1.name} and ${p2.name}`,
          });
        }
        return { message: "People linked." };
      }
      if (family.partner2_id === firstPersonId && family.partner1_id === null) {
        family.partner1_id = secondPersonId;
        family.relationship_status = relationshipStatus || family.relationship_status || "partner";
        this.saveFamilyUnit(family);
        if (actor) {
          this.logActivity({
            family_id: ownerId,
            actor_id: actor.id,
            actor_name: actor.name,
            action: "RELATIONSHIP_ADDED",
            target_type: "relationship",
            description: `${actor.name} linked ${p1.name} and ${p2.name}`,
          });
        }
        return { message: "People linked." };
      }
      if (family.partner2_id === secondPersonId && family.partner1_id === null) {
        family.partner1_id = firstPersonId;
        family.relationship_status = relationshipStatus || family.relationship_status || "partner";
        this.saveFamilyUnit(family);
        if (actor) {
          this.logActivity({
            family_id: ownerId,
            actor_id: actor.id,
            actor_name: actor.name,
            action: "RELATIONSHIP_ADDED",
            target_type: "relationship",
            description: `${actor.name} linked ${p1.name} and ${p2.name}`,
          });
        }
        return { message: "People linked." };
      }
    }

    const fu: FamilyUnit = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      partner1_id: firstPersonId,
      partner2_id: secondPersonId,
      relationship_status: relationshipStatus || "partner",
      created_at: new Date().toISOString(),
    };
    this.saveFamilyUnit(fu);

    if (actor) {
      this.logActivity({
        family_id: ownerId,
        actor_id: actor.id,
        actor_name: actor.name,
        action: "RELATIONSHIP_ADDED",
        target_type: "relationship",
        description: `${actor.name} linked ${p1.name} and ${p2.name}`,
      });
    }

    return { message: "People linked." };
  }

  // --- Update Person with Cross-Field Date Validation (Fixes Issue 7) ---
  updatePerson(
    id: string,
    ownerId: string,
    updates: Partial<{
      name: string;
      gender: string | null;
      date_of_birth: string | null;
      date_of_death: string | null;
      place_of_birth: string | null;
      occupation: string | null;
      bio: string | null;
      address: string | null;
      phone: string | null;
      photo_url: string | null;
    }>,
    actor?: { id: string; name: string }
  ): PersonOut {
    const person = this.getPerson(id, ownerId);
    if (!person) throw new Error("Person not found");

    // Cross-field validation merging existing record and partial patch
    const effectiveBirth = updates.date_of_birth !== undefined ? updates.date_of_birth : person.date_of_birth;
    const effectiveDeath = updates.date_of_death !== undefined ? updates.date_of_death : person.date_of_death;

    if (effectiveBirth && effectiveDeath) {
      if (new Date(effectiveBirth).getTime() > new Date(effectiveDeath).getTime()) {
        throw new Error("Date of death cannot be earlier than date of birth");
      }
    }

    if (updates.name !== undefined) person.name = updates.name;
    if (updates.gender !== undefined) person.gender = updates.gender;
    if (updates.date_of_birth !== undefined) person.date_of_birth = updates.date_of_birth;
    if (updates.date_of_death !== undefined) person.date_of_death = updates.date_of_death;
    if (updates.place_of_birth !== undefined) person.place_of_birth = updates.place_of_birth;
    if (updates.occupation !== undefined) person.occupation = updates.occupation;
    if (updates.bio !== undefined) person.bio = updates.bio;
    if (updates.address !== undefined) person.address = updates.address;
    if (updates.phone !== undefined) person.phone = updates.phone;
    if (updates.photo_url !== undefined) person.photo_url = updates.photo_url;

    dbSavePerson(person).catch((e) => logger.error("dbSavePerson error:", e));

    if (actor) {
      this.logActivity({
        family_id: ownerId,
        actor_id: actor.id,
        actor_name: actor.name,
        action: "PERSON_UPDATED",
        target_type: "person",
        target_id: person.id,
        target_name: person.name,
        description: `${actor.name} updated details for ${person.name}`,
      });
    }

    return this.serializePerson(person);
  }

  // --- Delete Person ---
  deletePerson(
    id: string,
    ownerId: string,
    actor?: { id: string; name: string }
  ): { message: string } {
    const person = this.getPerson(id, ownerId);
    if (!person) throw new Error("Person not found");
    const personName = person.name;

    for (const [fcId, fc] of this.familyChildren.entries()) {
      if (fc.person_id === id) {
        this.familyChildren.delete(fcId);
        dbDeleteFamilyChild(fcId).catch((e) => logger.error("dbDeleteFamilyChild error:", e));
      }
    }

    for (const fu of this.familyUnits.values()) {
      if (fu.owner_id === ownerId) {
        let changed = false;
        if (fu.partner1_id === id) { fu.partner1_id = null; changed = true; }
        if (fu.partner2_id === id) { fu.partner2_id = null; changed = true; }
        if (changed) {
          dbSaveFamilyUnit(fu).catch((e) => logger.error("dbSaveFamilyUnit error:", e));
        }
      }
    }

    this.people.delete(id);
    dbDeletePerson(id).catch((e) => logger.error("dbDeletePerson error:", e));

    // Clean up empty orphaned family units
    for (const [fuId, fu] of this.familyUnits.entries()) {
      if (fu.owner_id === ownerId && fu.partner1_id === null && fu.partner2_id === null) {
        const hasChildren = Array.from(this.familyChildren.values()).some(
          (c) => c.family_unit_id === fuId
        );
        if (!hasChildren) {
          this.familyUnits.delete(fuId);
          dbDeleteFamilyUnit(fuId).catch((e) => logger.error("dbDeleteFamilyUnit error:", e));
        }
      }
    }

    if (actor) {
      this.logActivity({
        family_id: ownerId,
        actor_id: actor.id,
        actor_name: actor.name,
        action: "PERSON_DELETED",
        target_type: "person",
        target_id: id,
        target_name: personName,
        description: `${actor.name} removed ${personName} from the family tree`,
      });
    }

    return { message: "Person removed." };
  }

  // --- Family & Collaboration Management ---
  getOrCreateFamilyForUser(user: User): Family {
    let family = this.families.get(user.id);
    if (!family) {
      family = {
        id: user.id,
        owner_id: user.id,
        name: `${user.name}'s Family`,
        created_at: new Date().toISOString(),
      };
      this.families.set(family.id, family);
      dbSaveFamily(family).catch((e) => logger.error("dbSaveFamily error:", e));

      // Ensure owner is registered as owner member
      const memberId = `${family.id}-${user.id}`;
      if (!this.familyMembers.has(memberId)) {
        const member = {
          id: memberId,
          family_id: family.id,
          user_id: user.id,
          role: "owner" as FamilyRole,
          joined_at: family.created_at,
        };
        this.familyMembers.set(memberId, member);
        dbSaveFamilyMember(member).catch((e) => logger.error("dbSaveFamilyMember error:", e));
      }

      this.logActivity({
        family_id: family.id,
        actor_id: user.id,
        actor_name: user.name,
        action: "FAMILY_CREATED",
        target_type: "family",
        target_id: family.id,
        target_name: family.name,
        description: `${user.name} created ${family.name}`,
      });
    }
    return family;
  }

  async getOrCreateFamilyForUserAsync(user: User): Promise<Family> {
    let family = this.families.get(user.id);
    if (!family) {
      family = {
        id: user.id,
        owner_id: user.id,
        name: `${user.name}'s Family`,
        created_at: new Date().toISOString(),
      };
      this.families.set(family.id, family);
      await dbSaveFamily(family);

      // Ensure owner is registered as owner member
      const memberId = `${family.id}-${user.id}`;
      if (!this.familyMembers.has(memberId)) {
        const member = {
          id: memberId,
          family_id: family.id,
          user_id: user.id,
          role: "owner" as FamilyRole,
          joined_at: family.created_at,
        };
        this.familyMembers.set(memberId, member);
        await dbSaveFamilyMember(member);
      }

      this.logActivity({
        family_id: family.id,
        actor_id: user.id,
        actor_name: user.name,
        action: "FAMILY_CREATED",
        target_type: "family",
        target_id: family.id,
        target_name: family.name,
        description: `${user.name} created ${family.name}`,
      });
    }
    return family;
  }

  getFamily(familyId: string): Family | null {
    return this.families.get(familyId) || null;
  }

  getUserFamilies(userId: string): { family: Family; role: FamilyRole }[] {
    const list: { family: Family; role: FamilyRole }[] = [];
    const seen = new Set<string>();

    for (const m of this.familyMembers.values()) {
      if (m.user_id === userId) {
        const fam = this.families.get(m.family_id);
        if (fam && !seen.has(fam.id)) {
          seen.add(fam.id);
          list.push({ family: fam, role: m.role });
        }
      }
    }

    const user = this.users.get(userId);
    if (user && !seen.has(user.id)) {
      const ownFamily = this.getOrCreateFamilyForUser(user);
      list.unshift({ family: ownFamily, role: "owner" });
    }

    return list;
  }

  checkFamilyAccess(userId: string, familyId: string): { family: Family; role: FamilyRole } | null {
    const family = this.families.get(familyId);
    if (!family) return null;

    if (family.owner_id === userId) {
      return { family, role: "owner" };
    }

    const user = this.users.get(userId);
    const email = user?.email.toLowerCase().trim() || "";

    for (const s of this.treeShares.values()) {
      if (
        s.family_id === familyId &&
        (s.user_id === userId || (email && s.user_id.toLowerCase().trim() === email))
      ) {
        return { family, role: s.permission };
      }
    }

    const memberId = `${familyId}-${userId}`;
    const member = this.familyMembers.get(memberId);
    if (member) {
      return { family, role: member.role };
    }

    for (const inv of this.familyInvitations.values()) {
      if (
        inv.family_id === familyId &&
        inv.status === "accepted" &&
        (inv.accepted_by_user_id === userId || (email && inv.invitee_email.toLowerCase().trim() === email))
      ) {
        return { family, role: (inv.permission as FamilyRole) || "viewer" };
      }
    }

    return null;
  }

  getFamilyAccess(userId: string, familyId: string): { family: Family; role: FamilyRole } | null {
    return this.checkFamilyAccess(userId, familyId);
  }

  isFamilyOwner(userId: string, familyId: string): boolean {
    const access = this.checkFamilyAccess(userId, familyId);
    return access?.role === "owner";
  }

  canEditFamily(userId: string, familyId: string): boolean {
    const access = this.checkFamilyAccess(userId, familyId);
    return access?.role === "owner" || access?.role === "editor";
  }

  getUserTrees(userId: string, userObj?: User): {
    owned: { family: Family; role: "owner" };
    ownedList: Family[];
    shared: { family: Family; role: SharePermission; owner: { id: string; name: string; email: string } }[];
  } {
    const user = userObj || this.users.get(userId) || Array.from(this.users.values()).find((u) => u.id === userId);
    if (user && !this.users.has(user.id)) {
      this.users.set(user.id, user);
    }

    const ownedList: Family[] = [];
    for (const fam of this.families.values()) {
      if (fam && fam.owner_id === userId) {
        ownedList.push(fam);
      }
    }
    if (ownedList.length === 0) {
      if (user) {
        ownedList.push(this.getOrCreateFamilyForUser(user));
      } else {
        const fallbackFamily: Family = this.families.get(userId) || {
          id: userId,
          owner_id: userId,
          name: "My Family Tree",
          created_at: new Date().toISOString(),
        };
        this.families.set(fallbackFamily.id, fallbackFamily);
        ownedList.push(fallbackFamily);
      }
    }

    const defaultOwnFamily = ownedList[0];
    const shared: { family: Family; role: SharePermission; owner: { id: string; name: string; email: string } }[] = [];
    const normalizedUserEmail = user?.email.toLowerCase().trim() || "";

    // 1. Look up via treeShares
    for (const s of this.treeShares.values()) {
      const matchesUser =
        s.user_id === userId ||
        (normalizedUserEmail && s.user_id.toLowerCase().trim() === normalizedUserEmail);
      if (matchesUser) {
        let fam = this.families.get(s.family_id);
        if (!fam && s.family_id) {
          fam = {
            id: s.family_id,
            owner_id: s.owner_id || "owner",
            name: "Family Tree",
            created_at: s.created_at || new Date().toISOString(),
          };
          this.families.set(fam.id, fam);
        }
        if (fam && fam.owner_id !== userId) {
          const ownerUser = this.users.get(s.owner_id) || this.users.get(fam.owner_id);
          if (!shared.some((sh) => sh.family?.id === fam.id)) {
            shared.push({
              family: fam,
              role: s.permission,
              owner: {
                id: ownerUser?.id || fam.owner_id,
                name: ownerUser?.name || "Tree Owner",
                email: ownerUser?.email || "",
              },
            });
          }
        }
      }
    }

    // 2. Look up via familyMembers
    for (const m of this.familyMembers.values()) {
      if (m.user_id === userId && m.role !== "owner") {
        if (!shared.some((sh) => sh.family?.id === m.family_id)) {
          let fam = this.families.get(m.family_id);
          if (!fam && m.family_id) {
            fam = {
              id: m.family_id,
              owner_id: "owner",
              name: "Family Tree",
              created_at: m.joined_at || new Date().toISOString(),
            };
            this.families.set(fam.id, fam);
          }
          if (fam && fam.owner_id !== userId) {
            const ownerUser = this.users.get(fam.owner_id);
            shared.push({
              family: fam,
              role: (m.role as SharePermission) || "viewer",
              owner: {
                id: ownerUser?.id || fam.owner_id,
                name: ownerUser?.name || "Tree Owner",
                email: ownerUser?.email || "",
              },
            });
          }
        }
      }
    }

    // 3. Look up via accepted familyInvitations
    for (const inv of this.familyInvitations.values()) {
      if (
        inv.status === "accepted" &&
        (inv.accepted_by_user_id === userId ||
          (normalizedUserEmail && inv.invitee_email.toLowerCase().trim() === normalizedUserEmail))
      ) {
        if (!shared.some((sh) => sh.family?.id === inv.family_id)) {
          let fam = this.families.get(inv.family_id);
          if (!fam && inv.family_id) {
            fam = {
              id: inv.family_id,
              owner_id: inv.inviter_id || "owner",
              name: inv.family_name || "Family Tree",
              created_at: inv.created_at || new Date().toISOString(),
            };
            this.families.set(fam.id, fam);
          }
          if (fam && fam.owner_id !== userId) {
            const ownerUser = this.users.get(inv.inviter_id) || this.users.get(fam.owner_id);
            shared.push({
              family: fam,
              role: inv.permission || "viewer",
              owner: {
                id: ownerUser?.id || fam.owner_id,
                name: ownerUser?.name || inv.inviter_name || "Tree Owner",
                email: ownerUser?.email || inv.inviter_email || "",
              },
            });
          }
        }
      }
    }

    return {
      owned: { family: defaultOwnFamily, role: "owner" },
      ownedList,
      shared,
    };
  }

  createFamily(user: User, name: string): Family {
    const family: Family = {
      id: crypto.randomUUID(),
      owner_id: user.id,
      name: name.trim(),
      created_at: new Date().toISOString(),
    };
    this.families.set(family.id, family);
    dbSaveFamily(family).catch((e) => logger.error("dbSaveFamily error:", e));

    const memberId = `${family.id}-${user.id}`;
    const member: FamilyMember = {
      id: memberId,
      family_id: family.id,
      user_id: user.id,
      role: "owner",
      joined_at: family.created_at,
    };
    this.familyMembers.set(memberId, member);
    dbSaveFamilyMember(member).catch((e) => logger.error("dbSaveFamilyMember error:", e));

    this.logActivity({
      family_id: family.id,
      actor_id: user.id,
      actor_name: user.name,
      action: "FAMILY_CREATED",
      target_type: "family",
      target_id: family.id,
      target_name: family.name,
      description: `${user.name} created family tree "${family.name}"`,
    });

    return family;
  }

  renameFamily(userId: string, familyId: string, name: string): Family {
    const family = this.families.get(familyId);
    if (!family) throw new Error("Family tree not found.");
    if (family.owner_id !== userId) {
      throw new Error("Only the tree owner can rename this family tree.");
    }
    family.name = name.trim();
    dbSaveFamily(family).catch((e) => logger.error("dbSaveFamily error:", e));

    this.logActivity({
      family_id: family.id,
      actor_id: userId,
      actor_name: this.users.get(userId)?.name || "Owner",
      action: "FAMILY_UPDATED",
      target_type: "family",
      target_id: family.id,
      target_name: family.name,
      description: `Renamed family tree to "${family.name}"`,
    });

    return family;
  }

  deleteFamily(userId: string, familyId: string): boolean {
    const family = this.families.get(familyId);
    if (!family) throw new Error("Family tree not found.");
    if (family.owner_id !== userId) {
      throw new Error("Only the tree owner can delete this family tree.");
    }

    let ownedCount = 0;
    for (const f of this.families.values()) {
      if (f.owner_id === userId) ownedCount++;
    }
    if (ownedCount <= 1) {
      throw new Error("You cannot delete your only family tree.");
    }

    this.families.delete(familyId);

    for (const [key, m] of this.familyMembers.entries()) {
      if (m.family_id === familyId) {
        this.familyMembers.delete(key);
      }
    }

    for (const [key, s] of this.treeShares.entries()) {
      if (s.family_id === familyId) {
        this.treeShares.delete(key);
      }
    }

    const personIdsToDelete: string[] = [];
    for (const p of this.people.values()) {
      if (p.owner_id === familyId) {
        personIdsToDelete.push(p.id);
      }
    }
    for (const pid of personIdsToDelete) {
      this.people.delete(pid);
    }

    const unitIdsToDelete: string[] = [];
    for (const u of this.familyUnits.values()) {
      if (u.owner_id === familyId) {
        unitIdsToDelete.push(u.id);
      }
    }
    for (const uid of unitIdsToDelete) {
      this.familyUnits.delete(uid);
      for (const [cid, c] of this.familyChildren.entries()) {
        if (c.family_unit_id === uid) {
          this.familyChildren.delete(cid);
        }
      }
    }

    dbDeleteFamily(familyId).catch((e) => logger.error("dbDeleteFamily error:", e));
    return true;
  }

  async deleteUserAccount(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    const userEmail = user?.email?.toLowerCase().trim() || "";

    // 1. Identify all families owned by this user
    const ownedFamilyIds = new Set<string>();
    for (const f of this.families.values()) {
      if (f.owner_id === userId) {
        ownedFamilyIds.add(f.id);
      }
    }

    // 2. Delete all owned families
    for (const familyId of ownedFamilyIds) {
      this.families.delete(familyId);
    }

    // 3. Delete people belonging to owned families or owned by this user
    const peopleToDelete: string[] = [];
    for (const [pid, p] of this.people.entries()) {
      if (p.owner_id === userId || ownedFamilyIds.has(p.owner_id)) {
        peopleToDelete.push(pid);
      }
    }
    for (const pid of peopleToDelete) {
      this.people.delete(pid);
    }

    // 4. Delete family units & children belonging to owned families or this user
    const unitsToDelete: string[] = [];
    for (const [uid, u] of this.familyUnits.entries()) {
      if (u.owner_id === userId || ownedFamilyIds.has(u.owner_id)) {
        unitsToDelete.push(uid);
      }
    }
    for (const uid of unitsToDelete) {
      this.familyUnits.delete(uid);
      for (const [cid, c] of this.familyChildren.entries()) {
        if (c.family_unit_id === uid) {
          this.familyChildren.delete(cid);
        }
      }
    }

    // Also purge family children referencing deleted people
    const peopleSet = new Set(peopleToDelete);
    for (const [cid, c] of this.familyChildren.entries()) {
      if (peopleSet.has(c.person_id)) {
        this.familyChildren.delete(cid);
      }
    }

    // 5. Delete family members & tree shares
    for (const [key, m] of this.familyMembers.entries()) {
      if (m.user_id === userId || ownedFamilyIds.has(m.family_id)) {
        this.familyMembers.delete(key);
      }
    }

    for (const [key, s] of this.treeShares.entries()) {
      if (s.user_id === userId || s.owner_id === userId || ownedFamilyIds.has(s.family_id)) {
        this.treeShares.delete(key);
      }
    }

    // 6. Delete family invitations
    for (const [key, inv] of this.familyInvitations.entries()) {
      if (
        inv.inviter_id === userId ||
        inv.accepted_by_user_id === userId ||
        ownedFamilyIds.has(inv.family_id) ||
        (userEmail && inv.invitee_email.toLowerCase().trim() === userEmail)
      ) {
        this.familyInvitations.delete(key);
      }
    }

    // 7. Delete activity logs and chat histories
    this.activityLogs = this.activityLogs.filter(
      (log) => log.actor_id !== userId && !ownedFamilyIds.has(log.family_id)
    );
    for (const key of Array.from(this.chatHistories.keys())) {
      if (key.startsWith(`${userId}:`) || Array.from(ownedFamilyIds).some((fid) => key.endsWith(`:${fid}`))) {
        this.chatHistories.delete(key);
      }
    }

    // 8. Delete reset tokens & OTPs
    for (const [tid, token] of this.resetTokens.entries()) {
      if (token.user_id === userId) {
        this.resetTokens.delete(tid);
      }
    }
    for (const [oid, otp] of this.resetOtps.entries()) {
      if (otp.user_id === userId || (userEmail && otp.email.toLowerCase().trim() === userEmail)) {
        this.resetOtps.delete(oid);
      }
    }

    // 9. Delete user record from memory
    this.users.delete(userId);

    // 10. Record email in deleted accounts with 24-hour cooldown
    if (userEmail) {
      const now = new Date();
      const cooldownUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24-hour cooling-off period
      const deletedRecord: DeletedAccountRecord = {
        id: crypto.randomUUID(),
        email: userEmail,
        deleted_at: now.toISOString(),
        cooldown_until: cooldownUntil.toISOString(),
      };
      this.deletedAccounts.set(userEmail, deletedRecord);
      await dbSaveDeletedAccount(deletedRecord);
    }

    // 11. Persist deletion in PostgreSQL
    await dbDeleteUserAccount(userId, userEmail);

    logger.info(`[Store] Purged account and all tree data for user ${userId} (${userEmail})`);
    return true;
  }

  removeSharedTreeForUser(userId: string, familyId: string): boolean {
    for (const [key, s] of this.treeShares.entries()) {
      if (s.family_id === familyId && s.user_id === userId) {
        this.treeShares.delete(key);
        dbDeleteTreeShare(s.id).catch((e) => logger.error("dbDeleteTreeShare error:", e));
        return true;
      }
    }
    return false;
  }

  async createOrUpdateTreeShare(params: {
    ownerId: string;
    familyId: string;
    email: string;
    permission: SharePermission;
  }): Promise<{ share: TreeShare; recipient: { id: string; name: string; email: string } }> {
    const family = this.families.get(params.familyId);
    if (!family) {
      throw new Error("Family tree not found");
    }

    if (family.owner_id !== params.ownerId) {
      throw new Error("Only the tree owner can manage sharing permissions");
    }

    const normalizedEmail = params.email.toLowerCase().trim();
    if (!normalizedEmail) {
      throw new Error("Email is required");
    }

    if (params.permission !== "viewer" && params.permission !== "editor") {
      throw new Error("Invalid permission: must be 'viewer' or 'editor'");
    }

    const recipient = this.findUserByEmail(normalizedEmail);
    if (!recipient) {
      throw new Error("That user does not have a Rootline account.");
    }

    if (recipient.id === params.ownerId) {
      throw new Error("You already own this family tree.");
    }

    const now = new Date().toISOString();
    const existing = Array.from(this.treeShares.values()).find(
      (s) => s.family_id === params.familyId && s.user_id === recipient.id
    );

    const owner = this.users.get(params.ownerId);

    if (existing) {
      existing.permission = params.permission;
      existing.updated_at = now;
      await dbSaveTreeShare(existing);

      // Mark any pending invitations for this user and family as accepted
      for (const inv of this.familyInvitations.values()) {
        if (
          inv.family_id === params.familyId &&
          inv.invitee_email.toLowerCase() === normalizedEmail &&
          inv.status === "pending"
        ) {
          inv.status = "accepted";
          inv.permission = params.permission;
          inv.accepted_at = now;
          inv.accepted_by_user_id = recipient.id;
          await dbUpdateInvitationStatus(inv.id, "accepted", now, recipient.id);
        }
      }

      this.logActivity({
        family_id: params.familyId,
        actor_id: params.ownerId,
        actor_name: owner?.name || "Owner",
        action: "SHARE_UPDATED",
        target_type: "share",
        target_id: existing.id,
        target_name: recipient.name,
        description: `${owner?.name || "Owner"} updated ${recipient.name}'s permission to ${params.permission}`,
      });

      return {
        share: existing,
        recipient: { id: recipient.id, name: recipient.name, email: recipient.email },
      };
    }

    const newShare: TreeShare = {
      id: crypto.randomUUID(),
      family_id: params.familyId,
      owner_id: params.ownerId,
      user_id: recipient.id,
      permission: params.permission,
      created_at: now,
      updated_at: now,
    };

    this.treeShares.set(newShare.id, newShare);
    await dbSaveTreeShare(newShare);

    // Also mark any pending invitations for this user on this family as accepted
    for (const inv of this.familyInvitations.values()) {
      if (
        inv.family_id === params.familyId &&
        inv.invitee_email.toLowerCase() === normalizedEmail &&
        inv.status === "pending"
      ) {
        inv.status = "accepted";
        inv.permission = params.permission;
        inv.accepted_at = now;
        inv.accepted_by_user_id = recipient.id;
        await dbUpdateInvitationStatus(inv.id, "accepted", now, recipient.id);
      }
    }

    this.logActivity({
      family_id: params.familyId,
      actor_id: params.ownerId,
      actor_name: owner?.name || "Owner",
      action: "TREE_SHARED",
      target_type: "share",
      target_id: newShare.id,
      target_name: recipient.name,
      description: `${owner?.name || "Owner"} shared the tree with ${recipient.name} as ${params.permission}`,
    });

    return {
      share: newShare,
      recipient: { id: recipient.id, name: recipient.name, email: recipient.email },
    };
  }

  getFamilyShares(userId: string, familyId: string): {
    owner: { id: string; name: string; email: string };
    shares: {
      id: string;
      user_id: string;
      name: string;
      user_name: string;
      email: string;
      user_email: string;
      permission: SharePermission;
      created_at: string;
      updated_at: string;
    }[];
    invitations?: FamilyInvitation[];
    currentUserRole: FamilyRole;
  } {
    const access = this.checkFamilyAccess(userId, familyId);
    if (!access) {
      throw new Error("Access denied to this family tree");
    }

    const family = access.family;
    const owner = this.users.get(family.owner_id);

    const shares: {
      id: string;
      user_id: string;
      name: string;
      user_name: string;
      email: string;
      user_email: string;
      permission: SharePermission;
      created_at: string;
      updated_at: string;
    }[] = [];

    for (const s of this.treeShares.values()) {
      if (s.family_id === familyId) {
        let u = this.users.get(s.user_id) || Array.from(this.users.values()).find(
          (user) => user.id === s.user_id || user.email.toLowerCase() === s.user_id.toLowerCase()
        );
        // Also look up any accepted invitation for this user/email
        const inv = Array.from(this.familyInvitations.values()).find(
          (i) => i.family_id === familyId && (i.accepted_by_user_id === s.user_id || i.invitee_email.toLowerCase() === (u?.email || s.user_id).toLowerCase())
        );

        const name = u?.name || (inv ? inv.invitee_email.split("@")[0] : (s.user_id.includes("@") ? s.user_id.split("@")[0] : "Collaborator"));
        const email = u?.email || inv?.invitee_email || (s.user_id.includes("@") ? s.user_id : "");

        shares.push({
          id: s.id,
          user_id: u?.id || s.user_id,
          name,
          user_name: name,
          email,
          user_email: email,
          permission: s.permission,
          created_at: s.created_at,
          updated_at: s.updated_at,
        });
      }
    }

    return {
      owner: {
        id: owner?.id || family.owner_id,
        name: owner?.name || "Tree Owner",
        email: owner?.email || "",
      },
      shares,
      invitations: this.getFamilyInvitations(userId, familyId),
      currentUserRole: access.role,
    };
  }

  updateTreeShare(ownerId: string, familyId: string, shareId: string, permission: SharePermission): TreeShare {
    const family = this.families.get(familyId);
    if (!family || family.owner_id !== ownerId) {
      throw new Error("Only the tree owner can change user permissions");
    }

    if (permission !== "viewer" && permission !== "editor") {
      throw new Error("Invalid permission: must be 'viewer' or 'editor'");
    }

    const share =
      this.treeShares.get(shareId) ||
      Array.from(this.treeShares.values()).find(
        (s) => s.family_id === familyId && (s.id === shareId || s.user_id === shareId)
      );

    if (!share || share.family_id !== familyId) {
      throw new Error("Share record not found");
    }

    share.permission = permission;
    share.updated_at = new Date().toISOString();
    dbSaveTreeShare(share).catch((e) => logger.error("dbSaveTreeShare error:", e));

    const owner = this.users.get(ownerId);
    const recipient = this.users.get(share.user_id);

    this.logActivity({
      family_id: familyId,
      actor_id: ownerId,
      actor_name: owner?.name || "Owner",
      action: "SHARE_PERMISSION_CHANGED",
      target_type: "share",
      target_id: share.id,
      target_name: recipient?.name || share.user_id,
      description: `${owner?.name || "Owner"} changed ${recipient?.name || "user"}'s permission to ${permission}`,
    });

    return share;
  }

  deleteTreeShare(ownerId: string, familyId: string, shareId: string): boolean {
    const family = this.families.get(familyId);
    if (!family || family.owner_id !== ownerId) {
      throw new Error("Only the tree owner can remove access");
    }

    const share =
      this.treeShares.get(shareId) ||
      Array.from(this.treeShares.values()).find(
        (s) => s.family_id === familyId && (s.id === shareId || s.user_id === shareId)
      );

    if (!share || share.family_id !== familyId) {
      throw new Error("Share record not found");
    }

    this.treeShares.delete(share.id);
    dbDeleteTreeShare(share.id).catch((e) => logger.error("dbDeleteTreeShare error:", e));

    const owner = this.users.get(ownerId);
    const recipient = this.users.get(share.user_id);

    this.logActivity({
      family_id: familyId,
      actor_id: ownerId,
      actor_name: owner?.name || "Owner",
      action: "SHARE_REMOVED",
      target_type: "share",
      target_id: share.id,
      target_name: recipient?.name || share.user_id,
      description: `${owner?.name || "Owner"} removed ${recipient?.name || "user"}'s access to the tree`,
    });

    return true;
  }

  // --- Family Tree Email Invitations ---
  async createFamilyInvitation(params: {
    ownerId: string;
    familyId: string;
    inviteeEmail: string;
    permission: SharePermission;
    message?: string | null;
  }): Promise<{ invitation: FamilyInvitation; isExistingUser: boolean; recipientUser: User | null }> {
    const family = this.families.get(params.familyId);
    if (!family) {
      throw new Error("Family tree not found");
    }

    if (family.owner_id !== params.ownerId) {
      throw new Error("Only the tree owner can send invitations");
    }

    const normalizedEmail = params.inviteeEmail.toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new Error("A valid email address is required");
    }

    if (params.permission !== "viewer" && params.permission !== "editor") {
      throw new Error("Invalid permission: must be 'viewer' or 'editor'");
    }

    const owner = this.users.get(params.ownerId);
    if (!owner) {
      throw new Error("Owner user not found");
    }

    if (owner.email.toLowerCase() === normalizedEmail) {
      throw new Error("You cannot invite yourself to your own family tree.");
    }

    const recipientUser = this.findUserByEmail(normalizedEmail);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Check if user is ALREADY an active collaborator on this tree
    const isAlreadyCollaborator = recipientUser && Array.from(this.treeShares.values()).some(
      (s) => s.family_id === params.familyId && s.user_id === recipientUser.id
    );

    // Look for ANY existing invitation for this family and email (pending or past)
    let invitation = Array.from(this.familyInvitations.values()).find(
      (inv) => inv.family_id === params.familyId && inv.invitee_email.toLowerCase() === normalizedEmail
    );

    if (invitation) {
      // Re-use and update the existing single invitation record to prevent duplicates
      invitation.permission = params.permission;
      invitation.message = params.message !== undefined ? params.message : invitation.message;
      invitation.expires_at = expiresAt;
      invitation.token = crypto.randomBytes(32).toString("hex");
      invitation.inviter_name = owner.name;
      invitation.inviter_email = owner.email;
      invitation.family_name = family.name;
      invitation.status = isAlreadyCollaborator ? "accepted" : "pending";
      if (isAlreadyCollaborator) {
        invitation.accepted_at = now.toISOString();
        invitation.accepted_by_user_id = recipientUser!.id;
      }
    } else {
      invitation = {
        id: crypto.randomUUID(),
        family_id: family.id,
        family_name: family.name,
        inviter_id: owner.id,
        inviter_name: owner.name,
        inviter_email: owner.email,
        invitee_email: normalizedEmail,
        permission: params.permission,
        token: crypto.randomBytes(32).toString("hex"),
        status: isAlreadyCollaborator ? "accepted" : "pending",
        message: params.message || null,
        created_at: now.toISOString(),
        expires_at: expiresAt,
        accepted_at: isAlreadyCollaborator ? now.toISOString() : null,
        accepted_by_user_id: isAlreadyCollaborator ? recipientUser!.id : null,
      };
      this.familyInvitations.set(invitation.id, invitation);
    }

    await dbSaveInvitation(invitation);

    this.logActivity({
      family_id: params.familyId,
      actor_id: owner.id,
      actor_name: owner.name,
      action: "INVITATION_SENT",
      target_type: "invitation",
      target_id: invitation.id,
      target_name: normalizedEmail,
      description: `${owner.name} invited ${normalizedEmail} to collaborate on ${family.name} as ${params.permission}`,
    });

    return {
      invitation,
      isExistingUser: Boolean(recipientUser),
      recipientUser: recipientUser || null,
    };
  }

  getInvitationByToken(token: string): FamilyInvitation | null {
    if (!token) return null;
    const invitation = Array.from(this.familyInvitations.values()).find((inv) => inv.token === token);
    if (!invitation) return null;

    if (invitation.status === "pending" && new Date(invitation.expires_at) < new Date()) {
      invitation.status = "expired";
      dbUpdateInvitationStatus(invitation.id, "expired").catch((e) => logger.error("dbUpdateInvitationStatus error:", e));
    }
    return invitation;
  }

  getInvitationById(id: string): FamilyInvitation | null {
    return this.familyInvitations.get(id) || null;
  }

  async acceptFamilyInvitation(
    token: string,
    acceptingUser: User
  ): Promise<{
    family: Family;
    share: TreeShare;
    invitation: FamilyInvitation;
  }> {
    const invitation = this.getInvitationByToken(token);
    if (!invitation) {
      throw new Error("Invalid or expired invitation link.");
    }

    if (invitation.status === "accepted") {
      throw new Error("This invitation has already been accepted.");
    }

    if (invitation.status === "expired" || new Date(invitation.expires_at) < new Date()) {
      invitation.status = "expired";
      await dbUpdateInvitationStatus(invitation.id, "expired");
      throw new Error("This invitation has expired. Please ask the tree owner to send a new invitation.");
    }

    if (invitation.status === "cancelled") {
      throw new Error("This invitation has been cancelled by the tree owner.");
    }

    const family = this.families.get(invitation.family_id);
    if (!family) {
      throw new Error("The associated family tree was not found.");
    }

    if (family.owner_id === acceptingUser.id) {
      throw new Error("You are already the owner of this family tree.");
    }

    const now = new Date().toISOString();

    // 1. Create or update TreeShare
    let share = Array.from(this.treeShares.values()).find(
      (s) => s.family_id === family.id && s.user_id === acceptingUser.id
    );

    if (share) {
      share.permission = invitation.permission;
      share.updated_at = now;
    } else {
      share = {
        id: crypto.randomUUID(),
        family_id: family.id,
        owner_id: family.owner_id,
        user_id: acceptingUser.id,
        permission: invitation.permission,
        created_at: now,
        updated_at: now,
      };
      this.treeShares.set(share.id, share);
    }
    await dbSaveTreeShare(share);

    // 2. Add as FamilyMember
    const memberId = `${family.id}-${acceptingUser.id}`;
    let member = this.familyMembers.get(memberId);
    if (member) {
      member.role = invitation.permission;
    } else {
      member = {
        id: memberId,
        family_id: family.id,
        user_id: acceptingUser.id,
        role: invitation.permission as FamilyRole,
        joined_at: now,
      };
      this.familyMembers.set(memberId, member);
    }
    await dbSaveFamilyMember(member);

    // 3. Update Invitation status
    invitation.status = "accepted";
    invitation.accepted_at = now;
    invitation.accepted_by_user_id = acceptingUser.id;
    await dbUpdateInvitationStatus(invitation.id, "accepted", now, acceptingUser.id);

    // 4. Resolve and mark any duplicate invitations for this user & family
    const normalizedUserEmail = acceptingUser.email.toLowerCase().trim();
    for (const otherInv of this.familyInvitations.values()) {
      if (
        otherInv.id !== invitation.id &&
        otherInv.family_id === family.id &&
        otherInv.invitee_email.toLowerCase().trim() === normalizedUserEmail &&
        otherInv.status === "pending"
      ) {
        otherInv.status = "accepted";
        otherInv.accepted_at = now;
        otherInv.accepted_by_user_id = acceptingUser.id;
        await dbUpdateInvitationStatus(otherInv.id, "accepted", now, acceptingUser.id);
      }
    }

    // 5. Activity log
    this.logActivity({
      family_id: family.id,
      actor_id: acceptingUser.id,
      actor_name: acceptingUser.name,
      action: "INVITATION_ACCEPTED",
      target_type: "invitation",
      target_id: invitation.id,
      target_name: acceptingUser.name,
      description: `${acceptingUser.name} accepted the invitation to join ${family.name} as ${invitation.permission}`,
    });

    return { family, share, invitation };
  }

  async declineFamilyInvitation(
    token: string,
    userId?: string
  ): Promise<{ success: boolean; invitation: FamilyInvitation }> {
    const invitation = this.getInvitationByToken(token);
    if (!invitation) {
      throw new Error("Invalid invitation link.");
    }
    if (invitation.status !== "pending") {
      throw new Error(`Invitation is already ${invitation.status}`);
    }

    invitation.status = "declined";
    await dbUpdateInvitationStatus(invitation.id, "declined");

    // Also mark duplicate pending invitations for this email on this tree as declined
    const normalizedEmail = invitation.invitee_email.toLowerCase().trim();
    for (const otherInv of this.familyInvitations.values()) {
      if (
        otherInv.id !== invitation.id &&
        otherInv.family_id === invitation.family_id &&
        otherInv.invitee_email.toLowerCase().trim() === normalizedEmail &&
        otherInv.status === "pending"
      ) {
        otherInv.status = "declined";
        await dbUpdateInvitationStatus(otherInv.id, "declined");
      }
    }

    const user = userId ? this.users.get(userId) : null;
    this.logActivity({
      family_id: invitation.family_id,
      actor_id: userId || "anonymous",
      actor_name: user?.name || invitation.invitee_email,
      action: "INVITATION_DECLINED",
      target_type: "invitation",
      target_id: invitation.id,
      target_name: invitation.invitee_email,
      description: `${user?.name || invitation.invitee_email} declined the invitation to join ${invitation.family_name}`,
    });

    return { success: true, invitation };
  }

  getFamilyInvitations(userId: string, familyId: string): FamilyInvitation[] {
    const access = this.checkFamilyAccess(userId, familyId);
    if (!access) {
      return [];
    }

    const now = new Date();
    const mapByEmail = new Map<string, FamilyInvitation>();

    // Scan invitations for this family
    const allForFamily = Array.from(this.familyInvitations.values()).filter(
      (inv) => inv.family_id === familyId
    );

    // Sort newest first
    allForFamily.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    for (const inv of allForFamily) {
      if (inv.status === "pending" && new Date(inv.expires_at) < now) {
        inv.status = "expired";
        dbUpdateInvitationStatus(inv.id, "expired").catch((e) => logger.error("dbUpdateInvitationStatus error:", e));
      }

      const emailKey = inv.invitee_email.toLowerCase().trim();
      // Keep highest priority invitation per email: pending > accepted > declined/expired/cancelled
      const existing = mapByEmail.get(emailKey);
      if (!existing) {
        mapByEmail.set(emailKey, inv);
      } else if (existing.status !== "pending" && inv.status === "pending") {
        mapByEmail.set(emailKey, inv);
      }
    }

    return Array.from(mapByEmail.values());
  }

  async getMyPendingInvitations(userEmail: string, userId?: string): Promise<FamilyInvitation[]> {
    if (!userEmail) return [];
    const normalized = userEmail.toLowerCase().trim();
    const now = new Date();

    // Query database directly if PostgreSQL is active to ensure cross-lambda consistency
    const dbInvites = await dbGetPendingInvitationsForEmail(normalized, userId);
    if (dbInvites && dbInvites.length > 0) {
      for (const inv of dbInvites) {
        this.familyInvitations.set(inv.id, inv);
      }
      return dbInvites;
    }

    // Fallback in-memory query with strict membership verification
    const results: FamilyInvitation[] = [];
    const seenFamilies = new Set<string>();

    for (const inv of this.familyInvitations.values()) {
      if (inv.invitee_email.toLowerCase().trim() === normalized) {
        if (inv.status === "pending" && new Date(inv.expires_at) < now) {
          inv.status = "expired";
          await dbUpdateInvitationStatus(inv.id, "expired");
          continue;
        }

        if (inv.status === "pending") {
          // If user owns or is already in treeShares for this family, skip & auto-accept
          if (userId) {
            const family = this.families.get(inv.family_id);
            if (family && family.owner_id === userId) {
              continue;
            }
            const isCollaborator = Array.from(this.treeShares.values()).some(
              (s) => s.family_id === inv.family_id && s.user_id === userId
            );
            if (isCollaborator) {
              inv.status = "accepted";
              inv.accepted_at = now.toISOString();
              inv.accepted_by_user_id = userId;
              await dbUpdateInvitationStatus(inv.id, "accepted", inv.accepted_at, userId);
              continue;
            }
          }

          if (!seenFamilies.has(inv.family_id)) {
            seenFamilies.add(inv.family_id);
            results.push(inv);
          }
        }
      }
    }
    return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async cancelFamilyInvitation(ownerId: string, invitationId: string): Promise<boolean> {
    const inv = this.familyInvitations.get(invitationId);
    if (!inv) {
      throw new Error("Invitation not found");
    }
    const family = this.families.get(inv.family_id);
    if (!family || family.owner_id !== ownerId) {
      throw new Error("Only the tree owner can cancel invitations");
    }

    inv.status = "cancelled";
    await dbUpdateInvitationStatus(inv.id, "cancelled");

    const owner = this.users.get(ownerId);
    this.logActivity({
      family_id: inv.family_id,
      actor_id: ownerId,
      actor_name: owner?.name || "Owner",
      action: "INVITATION_CANCELLED",
      target_type: "invitation",
      target_id: inv.id,
      target_name: inv.invitee_email,
      description: `${owner?.name || "Owner"} cancelled the invitation sent to ${inv.invitee_email}`,
    });

    return true;
  }

  async deleteFamilyInvitation(ownerId: string, invitationId: string): Promise<boolean> {
    const inv = this.familyInvitations.get(invitationId);
    if (!inv) {
      throw new Error("Invitation not found");
    }
    const family = this.families.get(inv.family_id);
    if (!family || family.owner_id !== ownerId) {
      throw new Error("Only the tree owner can delete invitations");
    }

    this.familyInvitations.delete(inv.id);
    await dbDeleteInvitation(inv.id);
    return true;
  }

  // --- Activity History Logging (Phase 2) ---
  logActivity(params: {
    family_id: string;
    actor_id: string;
    actor_name: string;
    action: ActivityAction;
    target_type: "person" | "relationship" | "member" | "share" | "family" | "invitation";
    target_id?: string | null;
    target_name?: string | null;
    description: string;
    details?: Record<string, { before?: any; after?: any }> | null;
  }): ActivityLog {
    const log: ActivityLog = {
      id: crypto.randomUUID(),
      family_id: params.family_id,
      actor_id: params.actor_id,
      actor_name: params.actor_name,
      action: params.action,
      target_type: params.target_type,
      target_id: params.target_id || null,
      target_name: params.target_name || null,
      description: params.description,
      details: params.details || null,
      created_at: new Date().toISOString(),
    };
    this.activityLogs.unshift(log);
    dbSaveActivityLog(log).catch((e) => logger.error("dbSaveActivityLog error:", e));
    return log;
  }

  getActivityHistory(
    familyId: string,
    options?: { category?: string; page?: number; limit?: number }
  ): { total: number; page: number; limit: number; items: ActivityLog[] } {
    const category = options?.category || "all";
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 30));

    let filtered = this.activityLogs.filter((log) => log.family_id === familyId);

    if (category === "people") {
      filtered = filtered.filter((l) => l.target_type === "person");
    } else if (category === "relationships") {
      filtered = filtered.filter((l) => l.target_type === "relationship");
    } else if (category === "members") {
      filtered = filtered.filter((l) => l.target_type === "member");
    } else if (category === "shares") {
      filtered = filtered.filter((l) => l.target_type === "share");
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return { total, page, limit, items };
  }

  // --- Family Statistics (Phase 3) ---
  calculateFamilyStatistics(familyId: string): FamilyStatistics {
    const people = this.getPeopleForOwner(familyId);
    const now = new Date();

    let maleCount = 0;
    let femaleCount = 0;
    let otherGenderCount = 0;
    let livingCount = 0;
    let deceasedCount = 0;

    const validAges: number[] = [];
    const validLifespans: number[] = [];
    let youngest: { id: string; name: string; dob: string; age?: number } | null = null;
    let oldestLiving: { id: string; name: string; dob: string; age?: number } | null = null;
    let oldestAncestor: { id: string; name: string; date_of_birth: string; age?: number } | null = null;
    let youngestPerson: { id: string; name: string; date_of_birth: string; age?: number } | null = null;

    let youngestDobTime = -Infinity;
    let oldestLivingDobTime = Infinity;
    let earliestAncestorDobTime = Infinity;
    let latestPersonDobTime = -Infinity;

    for (const p of people) {
      const g = (p.gender || "").toLowerCase();
      if (g === "male") maleCount++;
      else if (g === "female") femaleCount++;
      else otherGenderCount++;

      if (p.date_of_death) {
        deceasedCount++;
      } else {
        livingCount++;
      }

      if (p.date_of_birth) {
        const bDate = new Date(p.date_of_birth);
        if (!isNaN(bDate.getTime())) {
          const bTime = bDate.getTime();
          const endDate = p.date_of_death ? new Date(p.date_of_death) : now;
          let age = endDate.getFullYear() - bDate.getFullYear();
          const m = endDate.getMonth() - bDate.getMonth();
          if (m < 0 || (m === 0 && endDate.getDate() < bDate.getDate())) {
            age--;
          }
          if (age >= 0) {
            if (p.date_of_death) {
              validLifespans.push(age);
            } else {
              validAges.push(age);
              if (bTime < oldestLivingDobTime) {
                oldestLivingDobTime = bTime;
                oldestLiving = { id: p.id, name: p.name, dob: p.date_of_birth, age };
              }
            }
            if (bTime > youngestDobTime && !p.date_of_death) {
              youngestDobTime = bTime;
              youngest = { id: p.id, name: p.name, dob: p.date_of_birth, age };
            }
          }

          // Check earliest recorded ancestor (living or deceased)
          if (bTime < earliestAncestorDobTime) {
            earliestAncestorDobTime = bTime;
            oldestAncestor = { id: p.id, name: p.name, date_of_birth: p.date_of_birth, age: age >= 0 ? age : undefined };
          }
          if (bTime > latestPersonDobTime) {
            latestPersonDobTime = bTime;
            youngestPerson = { id: p.id, name: p.name, date_of_birth: p.date_of_birth, age: age >= 0 ? age : undefined };
          }
        }
      }
    }

    const averageAge = validAges.length
      ? Math.round((validAges.reduce((sum, a) => sum + a, 0) / validAges.length) * 10) / 10
      : null;

    const avgLifespan = validLifespans.length
      ? Math.round((validLifespans.reduce((sum, a) => sum + a, 0) / validLifespans.length) * 10) / 10
      : averageAge;

    // Unique partner pairs
    const partnerPairs = new Set<string>();
    const familyUnits = Array.from(this.familyUnits.values()).filter((fu) => fu.owner_id === familyId);
    for (const fu of familyUnits) {
      if (fu.partner1_id && fu.partner2_id) {
        const pair = [fu.partner1_id, fu.partner2_id].sort().join("|");
        partnerPairs.add(pair);
      }
    }
    for (const p of people) {
      for (const sid of p.spouse_ids || []) {
        const pair = [p.id, sid].sort().join("|");
        partnerPairs.add(pair);
      }
    }
    const couplesCount = partnerPairs.size;

    // People with at least one parent
    const childrenCount = people.filter((p) => (p.parent_ids || []).length > 0).length;

    // Family units with at least one child
    const unitChildCounts = new Map<string, number>();
    for (const fc of this.familyChildren.values()) {
      unitChildCounts.set(fc.family_unit_id, (unitChildCounts.get(fc.family_unit_id) || 0) + 1);
    }
    let parentFamiliesCount = 0;
    for (const fu of familyUnits) {
      if ((unitChildCounts.get(fu.id) || 0) > 0) {
        parentFamiliesCount++;
      }
    }

    // Generational hierarchy
    const childToParents = new Map<string, string[]>();
    for (const p of people) {
      childToParents.set(p.id, p.parent_ids || []);
    }

    const genMap = new Map<string, number>();
    const calcDepth = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 1;
      visited.add(id);
      const parents = childToParents.get(id) || [];
      if (!parents.length) return 1;
      let maxParentDepth = 0;
      for (const pid of parents) {
        maxParentDepth = Math.max(maxParentDepth, calcDepth(pid, new Set(visited)));
      }
      return maxParentDepth + 1;
    };

    for (const p of people) {
      genMap.set(p.id, calcDepth(p.id));
    }

    const generationsCount = people.length ? Math.max(...Array.from(genMap.values()), 1) : 0;

    const genCounts = new Map<number, number>();
    for (const g of genMap.values()) {
      genCounts.set(g, (genCounts.get(g) || 0) + 1);
    }
    const generationDistribution: { generation: number; count: number }[] = [];
    for (let g = 1; g <= generationsCount; g++) {
      generationDistribution.push({ generation: g, count: genCounts.get(g) || 0 });
    }

    // Number of branches (connected components)
    const adj = new Map<string, Set<string>>();
    for (const p of people) {
      if (!adj.has(p.id)) adj.set(p.id, new Set());
      for (const pid of p.parent_ids || []) {
        adj.get(p.id)!.add(pid);
        if (!adj.has(pid)) adj.set(pid, new Set());
        adj.get(pid)!.add(p.id);
      }
      for (const sid of p.spouse_ids || []) {
        adj.get(p.id)!.add(sid);
        if (!adj.has(sid)) adj.set(sid, new Set());
        adj.get(sid)!.add(p.id);
      }
    }

    const visitedComponents = new Set<string>();
    let branchesCount = 0;
    for (const p of people) {
      if (!visitedComponents.has(p.id)) {
        branchesCount++;
        const queue = [p.id];
        visitedComponents.add(p.id);
        while (queue.length) {
          const curr = queue.shift()!;
          for (const nxt of adj.get(curr) || []) {
            if (!visitedComponents.has(nxt)) {
              visitedComponents.add(nxt);
              queue.push(nxt);
            }
          }
        }
      }
    }

    // Top Surnames Ranking
    const surnameCounts = new Map<string, number>();
    for (const p of people) {
      const parts = (p.name || "").trim().split(/\s+/);
      if (parts.length > 1) {
        let surname = parts[parts.length - 1].replace(/[.,()]/g, "");
        if (/^(jr|sr|ii|iii|iv|v|esq)$/i.test(surname) && parts.length > 2) {
          surname = parts[parts.length - 2].replace(/[.,()]/g, "");
        }
        if (surname.length > 1) {
          surname = surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase();
          surnameCounts.set(surname, (surnameCounts.get(surname) || 0) + 1);
        }
      }
    }
    const top_surnames = Array.from(surnameCounts.entries())
      .map(([surname, count]) => ({ surname, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const avgChildrenPerFamily = couplesCount > 0
      ? Math.round((childrenCount / couplesCount) * 10) / 10
      : parentFamiliesCount > 0
      ? Math.round((childrenCount / parentFamiliesCount) * 10) / 10
      : 0;

    return {
      // CamelCase fields
      totalMembers: people.length,
      maleMembers: maleCount,
      femaleMembers: femaleCount,
      otherGenderMembers: otherGenderCount,
      livingMembers: livingCount,
      deceasedMembers: deceasedCount,
      couplesCount,
      generationsCount,
      youngestMember: youngest,
      oldestLivingMember: oldestLiving,
      averageAge,
      childrenCount,
      parentFamiliesCount,
      branchesCount,
      generationDistribution,

      // Snake_case fields
      total_people: people.length,
      living_count: livingCount,
      deceased_count: deceasedCount,
      max_generation_depth: generationsCount,
      total_couples: couplesCount,
      avg_children_per_family: avgChildrenPerFamily,
      avg_lifespan_years: avgLifespan,
      gender_distribution: {
        male: maleCount,
        female: femaleCount,
        other: otherGenderCount,
        unspecified: Math.max(0, people.length - (maleCount + femaleCount + otherGenderCount)),
      },
      top_surnames,
      oldest_ancestor: oldestAncestor,
      youngest_person: youngestPerson,
    };
  }

  // --- Family AI Chat History (Multi-tenant isolated per user and family) ---
  getChatHistory(userId: string, familyId: string): ChatMessage[] {
    const key = `${userId}:${familyId}`;
    return this.chatHistories.get(key) || [];
  }

  addChatMessage(
    userId: string,
    familyId: string,
    msg: Omit<ChatMessage, "id" | "timestamp" | "family_id" | "user_id">
  ): ChatMessage {
    const key = `${userId}:${familyId}`;
    const list = this.chatHistories.get(key) || [];
    const message: ChatMessage = {
      ...msg,
      id: crypto.randomUUID(),
      family_id: familyId,
      user_id: userId,
      timestamp: new Date().toISOString(),
    };
    list.push(message);
    if (list.length > 50) {
      list.shift();
    }
    this.chatHistories.set(key, list);
    dbSaveChatMessage(message).catch((e) => logger.error("dbSaveChatMessage error:", e));
    return message;
  }

  clearChatHistory(userId: string, familyId: string): void {
    const key = `${userId}:${familyId}`;
    this.chatHistories.delete(key);
  }

  // --- Seed Demo Data ---
  private seedDemoData() {
    const seedUser = this.createUser("Varun Shetty", "rootline.seed@example.com", "seed-password-123");
    const ownerId = seedUser.id;

    const reg: Record<string, string> = {};

    const createP = (
      key: string,
      name: string,
      relationType?: string,
      relatedKey?: string,
      fields?: Partial<Person>
    ) => {
      const out = this.createPerson(
        ownerId,
        {
          name,
          gender: fields?.gender,
          date_of_birth: fields?.date_of_birth,
          bio: fields?.bio,
          ...fields,
        },
        relationType && relatedKey
          ? { relation_type: relationType, related_to_id: reg[relatedKey] }
          : undefined
      );
      reg[key] = out.id;
      return out.id;
    };

    const root = (key: string, name: string, fields?: Partial<Person>) =>
      createP(key, name, undefined, undefined, fields);
    const spouse = (key: string, ofKey: string, name: string, fields?: Partial<Person>) =>
      createP(key, name, "spouse", ofKey, fields);
    const child = (key: string, ofKey: string, name: string, fields?: Partial<Person>) =>
      createP(key, name, "child", ofKey, fields);
    const link = (firstKey: string, secondKey: string) =>
      this.linkPeople(ownerId, reg[firstKey], reg[secondKey]);

    const DECEASED = { bio: "(deceased)" };

    // Mutthayya + Gulabi side
    root("mutthayya", "Mutthayya", { gender: "male", bio: "Maternal grandfather" });
    spouse("gulabi", "mutthayya", "Gulabi", { gender: "female", bio: "Maternal grandmother" });
    child("shubha", "mutthayya", "Shubha", { gender: "female", bio: "Mother (daughter of Mutthayya & Gulabi)" });
    child("padmavathi", "mutthayya", "Padmavathi", { gender: "female" });

    spouse("balakrishna", "padmavathi", "Balakrishna", { gender: "male" });
    child("nimmi", "padmavathi", "Nimmi", { gender: "female" });
    child("reshma", "padmavathi", "Reshma", { gender: "female" });
    child("munna", "padmavathi", "Munna", { gender: "male", ...DECEASED });

    // Praveen's family: parents Suresh & Geetha, 2 siblings Pradeep & Pooja
    root("suresh", "Suresh", { gender: "male", bio: "Praveen's father" });
    spouse("geetha", "suresh", "Geetha", { gender: "female", bio: "Praveen's mother" });
    child("praveen", "suresh", "Praveen", { gender: "male" });
    child("pradeep", "suresh", "Pradeep", { gender: "male", bio: "Praveen's brother" });
    child("pooja", "suresh", "Pooja", { gender: "female", bio: "Praveen's sister" });
    spouse("sneha", "pradeep", "Sneha", { gender: "female", bio: "Pradeep's wife" });

    // Link Praveen and Nimmi as spouses, with children Sristi & Sanvi
    link("praveen", "nimmi");
    child("sristi", "nimmi", "Sristi", { gender: "female" });
    child("sanvi", "nimmi", "Sanvi", { gender: "female" });

    // Ganesh's family: parents Manjunath & Sharada, 2 siblings Giridhara & Gayathri
    root("manjunath", "Manjunath", { gender: "male", bio: "Ganesh's father" });
    spouse("sharada", "manjunath", "Sharada", { gender: "female", bio: "Ganesh's mother" });
    child("ganesh", "manjunath", "Ganesh", { gender: "male" });
    child("giridhara", "manjunath", "Giridhara", { gender: "male", bio: "Ganesh's brother" });
    child("gayathri", "manjunath", "Gayathri", { gender: "female", bio: "Ganesh's sister" });
    spouse("swathi", "giridhara", "Swathi", { gender: "female", bio: "Giridhara's wife" });

    // Link Ganesh and Reshma as spouses, with children Poorvi & Gaman
    link("ganesh", "reshma");
    child("poorvi", "reshma", "Poorvi", { gender: "female" });
    child("gaman", "reshma", "Gaman", { gender: "male" });

    // Seena + Lakshmi side
    root("seena", "Seena", { gender: "male", bio: "Paternal grandfather (Babu's father)" });
    spouse("lakshmi", "seena", "Lakshmi", { gender: "female", bio: "Paternal grandmother" });

    child("ananda", "seena", "Ananda", { gender: "male" });
    child("ramakrishna", "seena", "Ramakrishna", { gender: "male" });
    child("keshava", "seena", "Keshava", { gender: "male" });
    child("bhaskar", "seena", "Bhaskar", { gender: "male", ...DECEASED });
    child("shantha", "seena", "Shantha", { gender: "female" });
    child("vedha", "seena", "Vedha", { gender: "female" });
    child("babu_sr", "seena", "Babu", {
      gender: "male",
      date_of_birth: "1968-10-31",
      bio: "Father (Varun's father — married to Shubha)",
    });

    // Ananda + Pushpa
    spouse("pushpa", "ananda", "Pushpa", { gender: "female" });
    child("vinod", "ananda", "Vinod", { gender: "male", bio: "Unmarried" });
    child("vidya", "ananda", "Vidya", { gender: "female" });
    spouse("vaibov", "vidya", "Vaibov", { gender: "male", ...DECEASED });
    child("kk", "vidya", "KK");

    // Ramakrishna + Sulochana
    spouse("sulochana", "ramakrishna", "Sulochana", { gender: "female" });
    child("rajani", "ramakrishna", "Rajani", { gender: "female" });
    child("ashwini", "ramakrishna", "Ashwini", { gender: "female" });

    spouse("babu_rajani_husband", "rajani", "Babu", { gender: "male", bio: "Rajani's husband" });
    child("aishu", "rajani", "Aishu", { gender: "female" });
    child("sonu", "rajani", "Sonu", { gender: "male" });

    spouse("ravi", "ashwini", "Ravi", { gender: "male" });
    child("prajna", "ashwini", "Prajna", { gender: "female" });

    // Keshava + Mohini
    spouse("mohini", "keshava", "Mohini", { gender: "female" });
    child("shilpa", "keshava", "Shilpa", { gender: "female" });
    child("roopa", "keshava", "Roopa", { gender: "female" });
    spouse("anil", "shilpa", "Anil", { gender: "male" });
    child("adyan", "shilpa", "Adyan", { gender: "male" });
    child("ayra", "shilpa", "Ayra", { gender: "female" });
    spouse("jeevan", "roopa", "Jeevan", { gender: "male" });

    // Bhaskar + Vasnthi
    spouse("vasnthi", "bhaskar", "Vasnthi", { gender: "female" });
    child("bhavana", "bhaskar", "Bhavana", { gender: "female" });
    child("pavan", "bhaskar", "Pavan", { gender: "male" });
    child("pallavi", "bhaskar", "Pallavi", { gender: "female" });
    spouse("bhavana_husband", "bhavana", "Bhavana's husband", { gender: "male" });
    child("x", "bhavana", "X");
    spouse("pavan_wife", "pavan", "Pavan's wife", { gender: "female" });
    child("pavan_kid", "pavan", "Pavan's child");
    spouse("pallavi_husband", "pallavi", "Pallavi's husband", { gender: "male" });
    child("pallavi_kid", "pallavi", "Pallavi's child");

    // Shantha + Ramesh
    spouse("ramesh", "shantha", "Ramesh", { gender: "male" });
    child("rajath", "shantha", "Rajath", { gender: "male" });
    child("ranjitha", "shantha", "Ranjitha", { gender: "female" });
    spouse("rajath_wife", "rajath", "Rajath's wife", { gender: "female" });
    child("rajath_kid", "rajath", "Rajath's child");
    spouse("rathnakar", "ranjitha", "Rathnakar", { gender: "male" });
    child("laksha", "ranjitha", "Laksha");

    // Vedha + DDP
    spouse("ddp", "vedha", "DDP", { gender: "male", ...DECEASED });
    child("divya", "vedha", "Divya", { gender: "female" });
    child("deepu", "vedha", "Deepu", { gender: "male" });
    child("deechu", "vedha", "Deechu", { gender: "female" });
    spouse("ani", "divya", "Ani", { gender: "male" });
    child("ayush", "divya", "Ayush", { gender: "male" });
    spouse("kiran", "deepu", "Kiran", { gender: "female" });
    child("keeyan", "deepu", "Keeyan");
    spouse("shreeya", "deechu", "Shreeya", { gender: "female" });
    child("shrehith", "deechu", "Shrehith");

    // Tie both sides: Babu marries Shubha
    link("babu_sr", "shubha");
    child("varun", "babu_sr", "Varun", { gender: "male", bio: "You" });
    child("varsha", "babu_sr", "Varsha", { gender: "female", bio: "Your sister" });
  }
}

export const store = new MemoryStore();
