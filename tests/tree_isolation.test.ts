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
    const result = store.createFamily(pachhu, "Apchus fam");
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

  it("collaborator cannot delete someone else's tree", () => {
    expect(() => {
      store.deleteFamily(collaborator.id, pachhuFamily.id);
    }).toThrow(/Only the tree owner can delete/);

    const family = store.getFamily(pachhuFamily.id);
    expect(family).toBeDefined();
  });

  it("collaborator cannot revoke or delete another user's share", () => {
    const thirdPartyShare = Array.from(store.treeShares.values()).find(
      (s) => s.family_id === pachhuFamily.id && s.user_id === thirdParty.id
    );
    expect(thirdPartyShare).toBeDefined();

    expect(() => {
      store.deleteTreeShare(collaborator.id, pachhuFamily.id, thirdPartyShare!.id);
    }).toThrow(/Only the tree owner can remove access/);
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

  it("collaborator can leave the shared tree cleanly", () => {
    const success = store.removeSharedTreeForUser(collaborator.id, pachhuFamily.id);
    expect(success).toBe(true);

    const treesAfter = store.getUserTrees(collaborator.id);
    expect(treesAfter.shared.some((s) => s.family.id === pachhuFamily.id)).toBe(false);
  });
});
