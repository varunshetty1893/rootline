"""
Corrected re-run of tests that previously failed due to wrong field names.
"""
import requests
import json

BASE = "http://localhost:8000"
SEED_EMAIL = "rootline.seed@example.com"
SEED_PASS = "seed-password-123"
VIEWER_EMAIL = "testfunc999@example.com"
VIEWER_PASS = "Functional1234!"

results = {}

def p(label, status, detail=""):
    icon = "PASS" if status else "FAIL"
    results[label] = icon
    print(f"[{icon}] {label}")
    if detail:
        print(f"       {detail}")
    print()

def login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    return s, r

def get_tree(session):
    trees = session.get(f"{BASE}/trees").json()
    owned = trees.get("owned_trees", [])
    if not owned:
        return None, []
    tid = owned[0]["id"]
    ppl = session.get(f"{BASE}/people", params={"tree_id": tid}).json()
    if not isinstance(ppl, list):
        ppl = ppl.get("people", [])
    return tid, ppl

# ── PEOPLE ───────────────────────────────────────
print("=" * 50)
print("CORRECTED PEOPLE TESTS")
print("=" * 50)

s, r = login(SEED_EMAIL, SEED_PASS)
tid, people = get_tree(s)
print(f"Tree: {tid}")
print(f"People count: {len(people)}")
print()

# PEOPLE-02 corrected: use name + date_of_birth
r = s.post(f"{BASE}/people", json={
    "name": "Functional TestPerson",
    "gender": "male",
    "date_of_birth": "1990-01-15"
})
print(f"PEOPLE-02 Add Person: HTTP {r.status_code}")
new_id = None
if r.status_code in [200, 201]:
    new_id = r.json().get("id")
    fields = list(r.json().keys())
    photo_present = "photo_url" in r.json()
    p("PEOPLE-02 Add Person", True, f"id={new_id} | fields={fields}")
    p("PEOPLE-06 Photo URL Field Present", photo_present, f"photo_url in response: {photo_present}")
else:
    p("PEOPLE-02 Add Person", False, f"HTTP {r.status_code}: {r.text[:300]}")
    p("PEOPLE-06 Photo URL Field", False, "Blocked by PEOPLE-02")

# PEOPLE-03 Edit
if new_id:
    r = s.put(f"{BASE}/people/{new_id}", json={"name": "FunctionalEdited", "gender": "male"})
    print(f"PEOPLE-03 Edit Person (PUT): HTTP {r.status_code}")
    if r.status_code in [200, 201]:
        updated = r.json()
        p("PEOPLE-03 Edit Person", True, f"name={updated.get('name')} | HTTP {r.status_code}")
    else:
        r2 = s.patch(f"{BASE}/people/{new_id}", json={"name": "FunctionalEdited"})
        print(f"PEOPLE-03 Edit Person (PATCH): HTTP {r2.status_code}")
        if r2.status_code in [200, 201]:
            p("PEOPLE-03 Edit Person", True, f"PATCH name={r2.json().get('name')}")
        else:
            p("PEOPLE-03 Edit Person", False, f"PUT={r.status_code} PATCH={r2.status_code}: {r2.text[:200]}")
else:
    p("PEOPLE-03 Edit Person", False, "Blocked - no person created")

# PEOPLE-07 Delete
if new_id:
    r = s.delete(f"{BASE}/people/{new_id}")
    print(f"PEOPLE-07 Delete Person: HTTP {r.status_code}")
    r_check = s.get(f"{BASE}/people/{new_id}")
    gone = r_check.status_code == 404
    p("PEOPLE-07 Delete Person", r.status_code in [200, 204],
      f"HTTP {r.status_code} | Verify GET after delete: {r_check.status_code} (gone={gone})")
else:
    p("PEOPLE-07 Delete Person", False, "Blocked - no person created")

# ── RELATIONSHIPS ─────────────────────────────────
print("=" * 50)
print("CORRECTED RELATIONSHIP TESTS")
print("=" * 50)

s, _ = login(SEED_EMAIL, SEED_PASS)
tid, people = get_tree(s)
print(f"People available: {len(people)}")
print()

if len(people) >= 2:
    p1_id = people[0]["id"]
    p2_id = people[1]["id"]
    p1_name = people[0].get("name", people[0].get("first_name", "?"))
    p2_name = people[1].get("name", people[1].get("first_name", "?"))
    print(f"Person 1: {p1_name}")
    print(f"Person 2: {p2_name}")
    print()

    # REL-02: Parent with corrected field names
    r = s.post(f"{BASE}/people/link", json={
        "first_person_id": p1_id,
        "second_person_id": p2_id,
        "relationship_type": "parent"
    })
    print(f"REL-02 Add Parent: HTTP {r.status_code}")
    p("REL-02 Add Parent Relationship", r.status_code in [200, 201, 409],
      f"HTTP {r.status_code} | {r.json() if r.status_code != 409 else 'already exists'}")

    # REL-03: Spouse
    r = s.post(f"{BASE}/people/link", json={
        "first_person_id": p1_id,
        "second_person_id": p2_id,
        "relationship_type": "spouse"
    })
    print(f"REL-03 Add Spouse: HTTP {r.status_code}")
    p("REL-03 Add Spouse Relationship", r.status_code in [200, 201, 409],
      f"HTTP {r.status_code}")

    # REL-04: Sibling
    if len(people) >= 3:
        p3_id = people[2]["id"]
        p3_name = people[2].get("name", people[2].get("first_name", "?"))
        r = s.post(f"{BASE}/people/link", json={
            "first_person_id": p1_id,
            "second_person_id": p3_id,
            "relationship_type": "sibling"
        })
        print(f"REL-04 Add Sibling ({p3_name}): HTTP {r.status_code}")
        p("REL-04 Add Sibling Relationship", r.status_code in [200, 201, 409],
          f"HTTP {r.status_code}")
    else:
        p("REL-04 Add Sibling Relationship", False, "BLOCKED - need 3+ people")

    # REL-07: Child
    r = s.post(f"{BASE}/people/link", json={
        "first_person_id": p2_id,
        "second_person_id": p1_id,
        "relationship_type": "child"
    })
    print(f"REL-07 Add Child: HTTP {r.status_code}")
    p("REL-07 Add Child Relationship", r.status_code in [200, 201, 409],
      f"HTTP {r.status_code}")

else:
    for tid2, tn in [("REL-02", "Parent"), ("REL-03", "Spouse"), ("REL-04", "Sibling"), ("REL-07", "Child")]:
        p(f"{tid2} {tn}", False, f"BLOCKED - only {len(people)} people found")

# ── SHARING ───────────────────────────────────────
print("=" * 50)
print("CORRECTED SHARING TESTS")
print("=" * 50)

# Check the actual ShareCreate schema first
resp = requests.get(f"{BASE}/openapi.json")
openapi = resp.json()
schemas = openapi.get("components", {}).get("schemas", {})
sc = schemas.get("ShareCreate", {})
print("ShareCreate schema:")
print(json.dumps(sc, indent=2))
print()

s_owner, _ = login(SEED_EMAIL, SEED_PASS)
tree_id, _ = get_tree(s_owner)

# Try each possible field name variant
share_id = None
for payload in [
    {"user_email": VIEWER_EMAIL, "role": "viewer"},
    {"email": VIEWER_EMAIL, "role": "viewer"},
    {"shared_with_email": VIEWER_EMAIL, "role": "viewer"},
]:
    r = s_owner.post(f"{BASE}/trees/{tree_id}/shares", json=payload)
    print(f"SHARING-02 payload={list(payload.keys())}: HTTP {r.status_code} -> {r.text[:150]}")
    if r.status_code in [200, 201]:
        share_id = r.json().get("id")
        p("SHARING-02 Share Tree - Grant Viewer", True,
          f"HTTP {r.status_code} | payload={list(payload.keys())} | share_id={share_id}")
        break
    elif r.status_code == 409:
        p("SHARING-02 Share Tree - Grant Viewer", True,
          f"HTTP 409 already exists (acceptable) | payload={list(payload.keys())}")
        # Try to find share_id
        shares_r = s_owner.get(f"{BASE}/trees/{tree_id}/shares")
        if shares_r.status_code == 200:
            for s in (shares_r.json() if isinstance(shares_r.json(), list) else []):
                u = s.get("user", {})
                if u.get("email") == VIEWER_EMAIL:
                    share_id = s.get("id")
                    break
        break
else:
    p("SHARING-02 Share Tree - Grant Viewer", False, f"All payload variants returned errors")

# SHARING-03: Viewer access
s_viewer, rv = login(VIEWER_EMAIL, VIEWER_PASS)
if rv.status_code == 200:
    r = s_viewer.get(f"{BASE}/trees/{tree_id}")
    print(f"SHARING-03 Viewer GET tree: HTTP {r.status_code}")
    p("SHARING-03 Viewer Access - Can View Tree", r.status_code == 200,
      f"HTTP {r.status_code}")

    # SHARING-04: Viewer cannot write
    r = s_viewer.post(f"{BASE}/people", json={"name": "HackAttempt"})
    print(f"SHARING-04 Viewer write attempt: HTTP {r.status_code}")
    p("SHARING-04 Viewer Cannot Modify (Read-only)", r.status_code in [401, 403],
      f"HTTP {r.status_code} ({'correctly blocked' if r.status_code in [401,403] else 'SECURITY ISSUE - write succeeded!'})")

    if share_id:
        # SHARING-06: Role -> editor
        r = s_owner.put(f"{BASE}/trees/{tree_id}/shares/{share_id}", json={"role": "editor"})
        print(f"SHARING-06 Change to editor: HTTP {r.status_code}")
        p("SHARING-06 Change Role to Editor", r.status_code in [200, 201],
          f"HTTP {r.status_code} | {r.text[:100] if r.status_code not in [200,201] else 'ok'}")

        # SHARING-07: Role -> viewer
        r = s_owner.put(f"{BASE}/trees/{tree_id}/shares/{share_id}", json={"role": "viewer"})
        print(f"SHARING-07 Change to viewer: HTTP {r.status_code}")
        p("SHARING-07 Change Role to Viewer", r.status_code in [200, 201],
          f"HTTP {r.status_code} | {r.text[:100] if r.status_code not in [200,201] else 'ok'}")

        # SHARING-08: Remove access
        r = s_owner.delete(f"{BASE}/trees/{tree_id}/shares/{share_id}")
        print(f"SHARING-08 Remove access: HTTP {r.status_code}")
        r_check = s_viewer.get(f"{BASE}/trees/{tree_id}")
        revoked = r_check.status_code in [401, 403, 404]
        p("SHARING-08 Remove Shared Access", r.status_code in [200, 204],
          f"HTTP {r.status_code} | Viewer after removal: {r_check.status_code} (revoked={revoked})")
    else:
        for tid3, tn in [("SHARING-06", "Role->Editor"), ("SHARING-07", "Role->Viewer"), ("SHARING-08", "Remove")]:
            p(f"{tid3} {tn}", False, "BLOCKED - no share_id")
else:
    for tid3, tn in [("SHARING-03","Viewer Access"), ("SHARING-04","Viewer No Write"),
                     ("SHARING-06","Role Editor"), ("SHARING-07","Role Viewer"), ("SHARING-08","Remove")]:
        p(f"{tid3} {tn}", False, f"BLOCKED - viewer login failed {rv.status_code}")

# ── SUMMARY ──────────────────────────────────────
print()
print("=" * 50)
print("CORRECTED TEST SUMMARY")
print("=" * 50)
passed = [k for k, v in results.items() if v == "PASS"]
failed = [k for k, v in results.items() if v == "FAIL"]
print(f"PASS ({len(passed)}):")
for t in passed: print(f"  {t}")
print(f"FAIL ({len(failed)}):")
for t in failed: print(f"  {t}")
