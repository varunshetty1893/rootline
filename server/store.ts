import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  isDatabaseConnected,
  loadInitialData,
  dbSaveUser,
  dbSaveResetToken,
  dbSaveFamily,
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
} from "./db.js";
import { logger } from "./logger.js";

const configuredBcryptRounds = Number.parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
const BCRYPT_ROUNDS = Number.isInteger(configuredBcryptRounds) && configuredBcryptRounds >= 12 && configuredBcryptRounds <= 15
  ? configuredBcryptRounds
  : 12;

export interface User {
  id: string;
  name: string;
  email: string;
  hashed_password?: string | null;
  google_id?: string | null;
  is_active: boolean;
  created_at: string;
  password_version: number;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used: boolean;
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
  | "TREE_SHARED"
  | "SHARE_UPDATED"
  | "SHARE_PERMISSION_CHANGED"
  | "SHARE_REMOVED";

export interface ActivityLog {
  id: string;
  family_id: string;
  actor_id: string;
  actor_name: string;
  action: ActivityAction;
  target_type: "person" | "relationship" | "member" | "share" | "family";
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
  people: Map<string, Person> = new Map();
  familyUnits: Map<string, FamilyUnit> = new Map();
  familyChildren: Map<string, FamilyChild> = new Map();

  families: Map<string, Family> = new Map();
  familyMembers: Map<string, FamilyMember> = new Map();
  treeShares: Map<string, TreeShare> = new Map();
  activityLogs: ActivityLog[] = [];
  chatHistories: Map<string, ChatMessage[]> = new Map(); // key: `${userId}:${familyId}`

  constructor() {
    // Fix Issue 2: Never seed demo accounts automatically in production!
    const isProduction = process.env.NODE_ENV === "production";
    const explicitSeed = process.env.SEED_DEMO_DATA === "true";
    if (!isProduction && process.env.SEED_DEMO_DATA !== "false") {
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
    this.activityLogs = data.activityLogs || [];

    for (const msg of data.chatMessages || []) {
      const key = `${msg.user_id}:${msg.family_id}`;
      const list = this.chatHistories.get(key) || [];
      list.push(msg);
      this.chatHistories.set(key, list);
    }

    // Only if database is completely brand new and empty AND not production, allow optional demo seed
    if (this.users.size === 0 && process.env.NODE_ENV !== "production" && process.env.SEED_DEMO_DATA === "true") {
      this.seedDemoData();
    }

    logger.info(`Initialized store from PostgreSQL (${this.users.size} users, ${this.people.size} people, ${this.families.size} families).`);
    return true;
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

  createUser(name: string, email: string, password?: string): User {
    const user: User = {
      id: crypto.randomUUID(),
      name,
      email: email.toLowerCase().trim(),
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

  updateUserPassword(userId: string, newPassword: string): User | null {
    const user = this.users.get(userId);
    if (!user) return null;
    user.hashed_password = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
    user.password_version += 1;
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

    for (const s of this.treeShares.values()) {
      if (s.family_id === familyId && s.user_id === userId) {
        return { family, role: s.permission };
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

  getUserTrees(userId: string): {
    owned: { family: Family; role: "owner" };
    shared: { family: Family; role: SharePermission; owner: { id: string; name: string; email: string } }[];
  } {
    const user = this.users.get(userId);
    const ownFamily = user
      ? this.getOrCreateFamilyForUser(user)
      : { id: userId, owner_id: userId, name: "My Family Tree", created_at: new Date().toISOString() };

    const shared: { family: Family; role: SharePermission; owner: { id: string; name: string; email: string } }[] = [];

    for (const s of this.treeShares.values()) {
      if (s.user_id === userId) {
        const fam = this.families.get(s.family_id);
        const ownerUser = this.users.get(s.owner_id);
        if (fam && ownerUser) {
          shared.push({
            family: fam,
            role: s.permission,
            owner: { id: ownerUser.id, name: ownerUser.name, email: ownerUser.email },
          });
        }
      }
    }

    return {
      owned: { family: ownFamily, role: "owner" },
      shared,
    };
  }

  createOrUpdateTreeShare(params: {
    ownerId: string;
    familyId: string;
    email: string;
    permission: SharePermission;
  }): { share: TreeShare; recipient: { id: string; name: string; email: string } } {
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
      dbSaveTreeShare(existing).catch((e) => logger.error("dbSaveTreeShare error:", e));

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
    dbSaveTreeShare(newShare).catch((e) => logger.error("dbSaveTreeShare error:", e));

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
      email: string;
      permission: SharePermission;
      created_at: string;
      updated_at: string;
    }[];
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
      email: string;
      permission: SharePermission;
      created_at: string;
      updated_at: string;
    }[] = [];

    for (const s of this.treeShares.values()) {
      if (s.family_id === familyId) {
        const u = this.users.get(s.user_id);
        if (u) {
          shares.push({
            id: s.id,
            user_id: u.id,
            name: u.name,
            email: u.email,
            permission: s.permission,
            created_at: s.created_at,
            updated_at: s.updated_at,
          });
        }
      }
    }

    return {
      owner: {
        id: owner?.id || family.owner_id,
        name: owner?.name || "Tree Owner",
        email: owner?.email || "",
      },
      shares,
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

  // --- Activity History Logging (Phase 2) ---
  logActivity(params: {
    family_id: string;
    actor_id: string;
    actor_name: string;
    action: ActivityAction;
    target_type: "person" | "relationship" | "member" | "share" | "family";
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

    spouse("praveen", "nimmi", "Praveen", { gender: "male" });
    child("sristi", "nimmi", "Sristi", { gender: "female" });
    child("sanvi", "nimmi", "Sanvi", { gender: "female" });

    spouse("ganesh", "reshma", "Ganesh", { gender: "male" });
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
