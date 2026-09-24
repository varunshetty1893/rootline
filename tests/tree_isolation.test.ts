import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStore } from "../server/store.js";

describe("Shared Tree Ownership Isolation & Privacy Tests", () => {
  let store: MemoryStore;
  let pachhu: any;
  let collaborator: any;
  let thirdParty: any;
  let pachhuFamily: any;

  beforeEach(async () => {
    store = new MemoryStore();
    pachhu = store.createUser("Pachhu", "pachhu@example.com", "secret123");
    collaborator = store.createUser("MyUser", "myuser@example.com", "secret123");
    thirdParty = store.createUser("ThirdParty", "third@example.com", "secret123");

    // Pachhu creates their family tree
    const result = await store.createFamily(pachhu, "Apchus fam");
    pachhuFamily = result.family;

    // Pachhu shares their tree with collaborator as viewer
    await store.createOrUpdateTreeShare({
      ownerId: pachhu.id,
      familyId: pachhuFamily.id,
      email: collaborator.email,
      permission: "viewer",
    });

    // Pachhu shares with thirdParty as editor
    await store.createOrUpdateTreeShare({
      ownerId: pachhu.id,
      familyId: pachhuFamily.id,
      email: thirdParty.email,
      permission: "editor",
    });
  });

  it("never includes a shared tree in the collaborator's ownedList", () => {
    const trees = store.getUserTrees(collaborator.id);

    // Owned trees should ONLY contain trees owned by collaborator
    expect(trees.ownedList.every((f) => f.owner_id === collaborator.id)).toBe(true);
    expect(trees.ownedList.some((f) => f.id === pachhuFamily.id)).toBe(false);

    // Shared trees must contain pachhuFamily
    const sharedRecord = trees.shared.find((s) => s.family.id === pachhuFamily.id);
    expect(sharedRecord).toBeDefined();
    expect(sharedRecord?.role).toBe("viewer");
    expect(sharedRecord?.owner.id).toBe(pachhu.id);
  });

  it("collaborator cannot rename someone else's tree", () => {
    expect(() => {
      store.renameFamily(collaborator.id, pachhuFamily.id, "Hacked Tree Name");
    }).toThrow(/Only the tree owner can rename/);

    const family = store.getFamily(pachhuFamily.id);
    expect(family?.name).toBe("Apchus fam");
  });

  it("collaborator cannot delete someone else's tree", async () => {
    await expect(
      store.deleteFamily(collaborator.id, pachhuFamily.id)
    ).rejects.toThrow(/Only the tree owner can delete/);

    const family = store.getFamily(pachhuFamily.id);
    expect(family).toBeDefined();
  });

  it("collaborator cannot revoke or delete another user's share", async () => {
    const thirdPartyShare = Array.from(store.treeShares.values()).find(
      (s) => s.family_id === pachhuFamily.id && s.user_id === thirdParty.id
    );
    expect(thirdPartyShare).toBeDefined();

    await expect(
      store.deleteTreeShare(collaborator.id, pachhuFamily.id, thirdPartyShare!.id)
    ).rejects.toThrow(/Only the tree owner can remove access/);
  });

  it("collaborator cannot modify another user's permissions", () => {
    const thirdPartyShare = Array.from(store.treeShares.values()).find(
      (s) => s.family_id === pachhuFamily.id && s.user_id === thirdParty.id
    );
    expect(thirdPartyShare).toBeDefined();

    expect(() => {
      store.updateTreeShare(collaborator.id, pachhuFamily.id, thirdPartyShare!.id, "viewer");
    }).toThrow(/Only the tree owner can change user permissions/);
  });

  it("collaborator can leave the shared tree cleanly", async () => {
    const success = await store.removeSharedTreeForUser(collaborator.id, pachhuFamily.id);
    expect(success).toBe(true);

    const treesAfter = store.getUserTrees(collaborator.id);
    expect(treesAfter.shared.some((s) => s.family.id === pachhuFamily.id)).toBe(false);
  });

  it("enforces unique tree names per user, but allows different users to use the same name", async () => {
    // User A cannot create another tree with the same name (case-insensitive)
    await expect(
      store.createFamily(pachhu, "Apchus fam")
    ).rejects.toThrow(/already have a family tree named/i);

    await expect(
      store.createFamily(pachhu, "apchus FAM")
    ).rejects.toThrow(/already have a family tree named/i);

    // User B (collaborator) CAN create a tree with the exact same name ("Apchus fam")
    const userBResult = await store.createFamily(collaborator, "Apchus fam");
    expect(userBResult.family).toBeDefined();
    expect(userBResult.family.owner_id).toBe(collaborator.id);
    expect(userBResult.family.name).toBe("Apchus fam");

    // Collaborator cannot create a second tree with that same name
    await expect(
      store.createFamily(collaborator, "Apchus fam")
    ).rejects.toThrow(/already have a family tree named/i);
  });

  it("completely deletes a tree and all associated records from all data sources", async () => {
    // Add people to pachhu's family
    const person1 = store.createPerson(
      pachhu.id,
      { name: "Grandparent", gender: "male" },
      { family_id: pachhuFamily.id }
    );
    const person2 = store.createPerson(
      pachhu.id,
      { name: "Child", gender: "female" },
      { family_id: pachhuFamily.id }
    );

    expect(store.getPeopleForOwner(pachhu.id).length).toBe(2);
    expect(store.getFamily(pachhuFamily.id)).toBeDefined();

    // Delete the family tree
    await store.deleteFamily(pachhu.id, pachhuFamily.id);

    // Verify family is completely removed
    expect(store.getFamily(pachhuFamily.id)).toBeFalsy();

    // Verify people are completely deleted
    expect(store.getPeopleForOwner(pachhu.id).length).toBe(0);
    expect(store.people.has(person1.id)).toBe(false);
    expect(store.people.has(person2.id)).toBe(false);

    // Verify shares are wiped
    const remainingShares = Array.from(store.treeShares.values()).filter(
      (s) => s.family_id === pachhuFamily.id
    );
    expect(remainingShares.length).toBe(0);

    // Verify it disappears from collaborator's shared trees list
    const collaboratorTrees = store.getUserTrees(collaborator.id);
    expect(collaboratorTrees.shared.some((s) => s.family.id === pachhuFamily.id)).toBe(false);

    // Verify it disappears from owner's owned trees list
    const ownerTrees = store.getUserTrees(pachhu.id);
    expect(ownerTrees.ownedList.some((f) => f.id === pachhuFamily.id)).toBe(false);
  });

  it("isolates data: User B only sees the explicitly shared tree and cannot see User A's private trees or people", async () => {
    // Pachhu creates a private tree that is NOT shared
    const privateResult = await store.createFamily(pachhu, "Pachhu Secret Branch");
    const privateFamily = privateResult.family;

    store.createPerson(
      pachhu.id,
      { name: "Private Uncle", gender: "male" },
      { family_id: privateFamily.id }
    );

    // Collaborator should only see pachhuFamily, never privateFamily
    const trees = store.getUserTrees(collaborator.id);
    const visibleFamilyIds = [
      ...trees.ownedList.map((f) => f.id),
      ...trees.shared.map((s) => s.family.id),
    ];

    expect(visibleFamilyIds).toContain(pachhuFamily.id);
    expect(visibleFamilyIds).not.toContain(privateFamily.id);

    // Collaborator cannot access people in pachhu's private family
    const collaboratorFamilies = store.getUserFamilies(collaborator.id);
    expect(collaboratorFamilies.some((f) => f.family.id === privateFamily.id)).toBe(false);
  });
});
