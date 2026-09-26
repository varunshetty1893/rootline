import { describe, it, expect } from "vitest";
import { store } from "../server/store.ts";

describe("Collaborative Editing, Snapshots, and Revisions", () => {
  const allUsers = Array.from(store.users.values());
  const ownerUser =
    allUsers.find((u) => u.email === "sbabushetty68@gmail.com") || {
      id: "usr_sbabushetty",
      name: "S Babu Shetty",
      email: "sbabushetty68@gmail.com",
    };

  it("Pachhu's shared tree is visible to collaborator", () => {
    const trees = store.getUserTrees(ownerUser.id, ownerUser as any);
    expect(trees.shared.length).toBeGreaterThan(0);
    const pachhuTree = trees.shared.find(
      (t) =>
        t.family.name.toLowerCase().includes("pachhu") ||
        (t.owner?.name && t.owner.name.toLowerCase().includes("pachhu"))
    );
    expect(pachhuTree).toBeDefined();
    expect(pachhuTree?.role).toBe("editor");
  });

  it("creates revision snapshots upon editing person in tree and supports restore", () => {
    const trees = store.getUserTrees(ownerUser.id, ownerUser as any);
    const tree = trees.shared[0]?.family || trees.owned.family;
    const treeId = tree.id;

    // Fetch initial tree state
    const people = store.getPeopleForOwner(treeId);
    const initialPeopleCount = people.length;

    // Collaborator creates a new person
    const newPerson = store.createPerson(
      treeId,
      {
        name: "Test Collaborator Relative",
        gender: "female",
        date_of_birth: "1995-04-12",
      },
      null,
      { id: ownerUser.id, name: ownerUser.name }
    );
    expect(newPerson).toBeDefined();

    // Check revisions list
    const revisionsAfterCreate = store.getTreeRevisions(treeId);
    expect(revisionsAfterCreate.length).toBeGreaterThan(0);
    const latestRev = revisionsAfterCreate[0];
    expect(latestRev.actor_name).toBe(ownerUser.name);
    expect(latestRev.people_count).toBe(initialPeopleCount + 1);

    // Update person
    const updated = store.updatePerson(
      newPerson.id,
      treeId,
      { bio: "Added important note by collaborator" },
      { id: ownerUser.id, name: ownerUser.name }
    );
    expect(updated?.bio).toBe("Added important note by collaborator");

    // Check revisions again
    const revisionsAfterUpdate = store.getTreeRevisions(treeId);
    expect(revisionsAfterUpdate.length).toBeGreaterThan(revisionsAfterCreate.length);

    // Now test restoring to an earlier snapshot before the update
    const previousSnapshotId = revisionsAfterCreate[0].id;
    const restoredData = store.restoreTreeSnapshot(
      treeId,
      previousSnapshotId,
      { id: "usr_pachhu", name: "Pachhu Shetty" },
      "Restored to before collaborator note"
    );
    expect(restoredData).toBeDefined();

    // Verify restored state: in the restored snapshot, the person had no bio
    const peopleAfterRestore = store.getPeopleForOwner(treeId);
    const personInRestored = peopleAfterRestore.find((p: any) => p.id === newPerson.id);
    expect(personInRestored?.bio).toBeFalsy();
  });

  it("allows manual save to create a named checkpoint snapshot", () => {
    const trees = store.getUserTrees(ownerUser.id, ownerUser as any);
    const tree = trees.owned?.family || trees.shared[0]?.family;
    const treeId = tree.id;

    const snapshot = store.createTreeSnapshot(
      treeId,
      { id: ownerUser.id, name: ownerUser.name },
      "MANUAL_SAVE",
      "Manual save checkpoint by user"
    );
    expect(snapshot).toBeDefined();
    expect(snapshot.description).toBe("Manual save checkpoint by user");

    const revs = store.getTreeRevisions(treeId);
    expect(revs[0].id).toBe(snapshot.id);
    expect(revs[0].description).toBe("Manual save checkpoint by user");
  });
});
