"""
Rootline Complete API Test Suite
Tests every endpoint with: valid, invalid, unauthorized, wrong-user, missing-fields,
malformed-ID, duplicate, not-found, and permission variants.

Endpoints discovered:
AUTH:    POST /auth/login|logout|register|forgot-password|reset-password
         GET  /auth/me|google/login|google/callback
TREES:   GET|PATCH /trees, /trees/{id}, /trees/{id}/activities
         GET|POST  /trees/{id}/shares
         PATCH|DELETE /trees/{id}/shares/{sid}
         (Duplicate routes under /families/trees/... — tested separately)
PEOPLE:  GET|POST /people, POST /people/link
         GET|PATCH|DELETE /people/{id}
MISC:    GET /health, POST /support

Run:  python docs/testing/run_api_tests.py
"""
import requests
import json
import time
import sys

BASE = "http://localhost:8000"

SEED_EMAIL    = "rootline.seed@example.com"
SEED_PASS     = "seed-password-123"
VIEWER_EMAIL  = "testfunc999@example.com"
VIEWER_PASS   = "Functional1234!"
NULL_UUID     = "00000000-0000-0000-0000-000000000000"

results = []

def rec(tid, name, result, obs, bug=False):
    results.append({"id": tid, "name": name, "result": result, "obs": obs, "bug": bug})
    flag = " [BUG]" if bug else ""
    icon = "PASS" if result == "PASS" else ("SKIP" if result == "SKIP" else "FAIL")
    print(f"  [{icon}]{flag} {tid}: {name}")
    print(f"         {obs}")

def login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    return s, r

def get_tree(session):
    r = session.get(f"{BASE}/trees")
    if r.status_code != 200:
        return None, []
    trees = r.json().get("owned_trees", [])
    if not trees:
        return None, []
    tid = trees[0]["id"]
    ppl = session.get(f"{BASE}/people", params={"tree_id": tid})
    people = ppl.json() if ppl.status_code == 200 and isinstance(ppl.json(), list) else []
    return tid, people

anon = requests.Session()

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 1: HEALTH")
print("="*60)

r = anon.get(f"{BASE}/health")
rec("HEALTH-01", "GET /health — unauthenticated", "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}: {r.json()}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 2: AUTH — /auth/register")
print("="*60)

# Valid registration
NEW_EMAIL = f"apitest.new.{int(time.time())}@example.com"
r = anon.post(f"{BASE}/auth/register", json={"name": "API Tester", "email": NEW_EMAIL, "password": "ApiTest1234!"})
rec("REG-01", "POST /auth/register — valid", "PASS" if r.status_code in [200,201] else "FAIL",
    f"HTTP {r.status_code}: {list(r.json().keys()) if r.status_code in [200,201] else r.text[:200]}")

# Duplicate email
r = anon.post(f"{BASE}/auth/register", json={"name": "Dup", "email": SEED_EMAIL, "password": SEED_PASS})
rec("REG-02", "POST /auth/register — duplicate email", "PASS" if r.status_code in [400,409] else "FAIL",
    f"HTTP {r.status_code}: {r.json().get('detail','')}")

# Missing name
r = anon.post(f"{BASE}/auth/register", json={"email": "missing@name.com", "password": "Pass1234!"})
rec("REG-03", "POST /auth/register — missing name", "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

# Missing email
r = anon.post(f"{BASE}/auth/register", json={"name": "NoEmail", "password": "Pass1234!"})
rec("REG-04", "POST /auth/register — missing email", "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

# Missing password
r = anon.post(f"{BASE}/auth/register", json={"name": "NoPass", "email": "nopass@test.com"})
rec("REG-05", "POST /auth/register — missing password", "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

# Invalid email format
r = anon.post(f"{BASE}/auth/register", json={"name": "Bad", "email": "not-an-email", "password": "Pass1234!"})
rec("REG-06", "POST /auth/register — invalid email format", "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

# Empty body
r = anon.post(f"{BASE}/auth/register", json={})
rec("REG-07", "POST /auth/register — empty body", "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 3: AUTH — /auth/login")
print("="*60)

time.sleep(1)
seed_session, r = login(SEED_EMAIL, SEED_PASS)
rec("LOGIN-01", "POST /auth/login — valid credentials", "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}: keys={list(r.json().keys()) if r.status_code==200 else r.text[:150]}")

time.sleep(1)
_, r = login(SEED_EMAIL, "wrongpassword123")
rec("LOGIN-02", "POST /auth/login — wrong password", "PASS" if r.status_code in [400,401,403] else "FAIL",
    f"HTTP {r.status_code}: {r.json().get('detail','')}")

time.sleep(1)
_, r = login("nobody_xyz@noexist.com", "anything")
rec("LOGIN-03", "POST /auth/login — non-existent email", "PASS" if r.status_code in [400,401,403,404] else "FAIL",
    f"HTTP {r.status_code}: {r.json().get('detail','')}")

r = anon.post(f"{BASE}/auth/login", json={"email": SEED_EMAIL})
rec("LOGIN-04", "POST /auth/login — missing password", "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

r = anon.post(f"{BASE}/auth/login", json={})
rec("LOGIN-05", "POST /auth/login — empty body", "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 4: AUTH — /auth/me, /auth/logout")
print("="*60)

seed_session, _ = login(SEED_EMAIL, SEED_PASS)

r = seed_session.get(f"{BASE}/auth/me")
rec("ME-01", "GET /auth/me — authenticated", "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}: fields={list(r.json().get('user', r.json()).keys()) if r.status_code==200 else r.text[:100]}")

r = anon.get(f"{BASE}/auth/me")
rec("ME-02", "GET /auth/me — unauthenticated", "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code==200)

r = seed_session.post(f"{BASE}/auth/logout")
rec("LOGOUT-01", "POST /auth/logout — authenticated", "PASS" if r.status_code in [200,204] else "FAIL",
    f"HTTP {r.status_code}")

r = seed_session.get(f"{BASE}/auth/me")
rec("LOGOUT-02", "GET /auth/me after logout — session dead", "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code==200)

r = anon.post(f"{BASE}/auth/logout")
rec("LOGOUT-03", "POST /auth/logout — unauthenticated", "PASS" if r.status_code in [200,204,401,403] else "FAIL",
    f"HTTP {r.status_code}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 5: AUTH — Password Reset")
print("="*60)

r = anon.post(f"{BASE}/auth/forgot-password", json={"email": SEED_EMAIL})
forgot_result = "PASS" if r.status_code in [200,201,202] else "FAIL"
rec("PWRESET-01", "POST /auth/forgot-password — valid email",
    forgot_result, f"HTTP {r.status_code}: {r.json()}")

r = anon.post(f"{BASE}/auth/forgot-password", json={"email": "nonexistent@nope.com"})
rec("PWRESET-02", "POST /auth/forgot-password — non-existent email",
    "PASS" if r.status_code in [200,404] else "FAIL",
    f"HTTP {r.status_code}: {r.json().get('detail','')} (200=safe enumeration, 404=leaks existence)")

r = anon.post(f"{BASE}/auth/forgot-password", json={})
rec("PWRESET-03", "POST /auth/forgot-password — empty body",
    "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

r = anon.post(f"{BASE}/auth/reset-password", json={"token": "invalid-bogus-token", "new_password": "NewPass1234!"})
rec("PWRESET-04", "POST /auth/reset-password — invalid token",
    "PASS" if r.status_code in [400,401,404,422] else "FAIL",
    f"HTTP {r.status_code}: {r.json().get('detail','')}")

r = anon.post(f"{BASE}/auth/reset-password", json={"token": "tok"})
rec("PWRESET-05", "POST /auth/reset-password — missing new_password",
    "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

r = anon.post(f"{BASE}/auth/reset-password", json={})
rec("PWRESET-06", "POST /auth/reset-password — empty body",
    "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 6: AUTH — Google OAuth")
print("="*60)

r = anon.get(f"{BASE}/auth/google/login", allow_redirects=False)
rec("GOOGLE-01", "GET /auth/google/login — redirects to Google",
    "PASS" if r.status_code in [200,302,307] else "FAIL",
    f"HTTP {r.status_code}")

r = anon.get(f"{BASE}/auth/google/callback", allow_redirects=False)
rec("GOOGLE-02", "GET /auth/google/callback — no code param (should reject)",
    "PASS" if r.status_code in [400,422,307,302] else "FAIL",
    f"HTTP {r.status_code}: {r.text[:100]}")

r = anon.get(f"{BASE}/auth/google/callback", params={"code": "bogus_code"}, allow_redirects=False)
rec("GOOGLE-03", "GET /auth/google/callback — invalid code",
    "PASS" if r.status_code in [400,401,422,302,307] else "FAIL",
    f"HTTP {r.status_code}: {r.text[:100]}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 7: TREES — GET/LIST/UPDATE")
print("="*60)

seed_session, _ = login(SEED_EMAIL, SEED_PASS)
viewer_session, _ = login(VIEWER_EMAIL, VIEWER_PASS)
tree_id, people = get_tree(seed_session)

# GET /trees
r = seed_session.get(f"{BASE}/trees")
rec("TREE-01", "GET /trees — authenticated owner",
    "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}: owned={len(r.json().get('owned_trees',[]))}, shared={len(r.json().get('shared_trees',[]))}")

r = anon.get(f"{BASE}/trees")
rec("TREE-02", "GET /trees — unauthenticated",
    "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code==200)

# GET /trees/{id}
r = seed_session.get(f"{BASE}/trees/{tree_id}")
rec("TREE-03", "GET /trees/{id} — valid authenticated",
    "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}: keys={list(r.json().keys())}")

r = anon.get(f"{BASE}/trees/{tree_id}")
rec("TREE-04", "GET /trees/{id} — unauthenticated",
    "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code==200)

r = seed_session.get(f"{BASE}/trees/{NULL_UUID}")
rec("TREE-05", "GET /trees/{id} — null UUID (not found)",
    "PASS" if r.status_code in [404,403] else "FAIL",
    f"HTTP {r.status_code}")

r = seed_session.get(f"{BASE}/trees/not-a-uuid-at-all")
rec("TREE-06", "GET /trees/{id} — malformed UUID",
    "PASS" if r.status_code in [400,404,422] else "FAIL",
    f"HTTP {r.status_code}")

# PATCH /trees/{id}
r = seed_session.patch(f"{BASE}/trees/{tree_id}", json={"name": "Updated Seed Tree"})
rec("TREE-07", "PATCH /trees/{id} — valid update",
    "PASS" if r.status_code in [200,201] else "FAIL",
    f"HTTP {r.status_code}: {r.json().get('name','') if r.status_code in [200,201] else r.text[:150]}")

r = anon.patch(f"{BASE}/trees/{tree_id}", json={"name": "HackUpdate"})
rec("TREE-08", "PATCH /trees/{id} — unauthenticated",
    "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code in [200,201])

r = viewer_session.patch(f"{BASE}/trees/{tree_id}", json={"name": "ViewerHack"})
rec("TREE-09", "PATCH /trees/{id} — wrong user (viewer of another tree)",
    "PASS" if r.status_code in [401,403,404] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code in [200,201])

r = seed_session.patch(f"{BASE}/trees/{NULL_UUID}", json={"name": "Ghost"})
rec("TREE-10", "PATCH /trees/{id} — not found",
    "PASS" if r.status_code in [404,403] else "FAIL",
    f"HTTP {r.status_code}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 8: TREES — Activities")
print("="*60)

r = seed_session.get(f"{BASE}/trees/{tree_id}/activities")
rec("ACT-01", "GET /trees/{id}/activities — valid",
    "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}: type={type(r.json()).__name__}, count={len(r.json()) if isinstance(r.json(),list) else r.json()}")

r = anon.get(f"{BASE}/trees/{tree_id}/activities")
rec("ACT-02", "GET /trees/{id}/activities — unauthenticated",
    "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code==200)

r = seed_session.get(f"{BASE}/trees/{NULL_UUID}/activities")
rec("ACT-03", "GET /trees/{id}/activities — not found",
    "PASS" if r.status_code in [404,403] else "FAIL",
    f"HTTP {r.status_code}")

r = viewer_session.get(f"{BASE}/trees/{tree_id}/activities")
rec("ACT-04", "GET /trees/{id}/activities — viewer of another tree (no access)",
    "PASS" if r.status_code in [401,403,404] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code==200)

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 9: TREES — Shares")
print("="*60)

# GET /trees/{id}/shares
r = seed_session.get(f"{BASE}/trees/{tree_id}/shares")
shares_data = r.json() if r.status_code == 200 else {}
rec("SHARE-01", "GET /trees/{id}/shares — owner",
    "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}: keys={list(shares_data.keys()) if isinstance(shares_data,dict) else type(shares_data).__name__}")

r = anon.get(f"{BASE}/trees/{tree_id}/shares")
rec("SHARE-02", "GET /trees/{id}/shares — unauthenticated",
    "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code==200)

r = viewer_session.get(f"{BASE}/trees/{tree_id}/shares")
rec("SHARE-03", "GET /trees/{id}/shares — non-owner viewer (other tree)",
    "PASS" if r.status_code in [401,403,404] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code==200)

r = seed_session.get(f"{BASE}/trees/{NULL_UUID}/shares")
rec("SHARE-04", "GET /trees/{id}/shares — not found",
    "PASS" if r.status_code in [404,403] else "FAIL",
    f"HTTP {r.status_code}")

# POST /trees/{id}/shares — valid (email + permission)
time.sleep(2)
r = seed_session.post(f"{BASE}/trees/{tree_id}/shares", json={"email": VIEWER_EMAIL, "permission": "viewer"})
share_id = None
if r.status_code in [200,201]:
    share_id = r.json().get("id")
    rec("SHARE-05", "POST /trees/{id}/shares — valid share grant",
        "PASS", f"HTTP {r.status_code}: share_id={share_id}")
else:
    rec("SHARE-05", "POST /trees/{id}/shares — valid share grant",
        "FAIL", f"HTTP {r.status_code}: {r.text[:200]}")

# Missing email
r = seed_session.post(f"{BASE}/trees/{tree_id}/shares", json={"permission": "viewer"})
rec("SHARE-06", "POST /trees/{id}/shares — missing email",
    "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

# Missing permission (should default to viewer or error)
r = seed_session.post(f"{BASE}/trees/{tree_id}/shares", json={"email": VIEWER_EMAIL})
rec("SHARE-07", "POST /trees/{id}/shares — missing permission (defaults ok?)",
    "PASS" if r.status_code in [200,201,400,409,422] else "FAIL",
    f"HTTP {r.status_code}: {r.text[:150]}")

# Invalid permission value
r = seed_session.post(f"{BASE}/trees/{tree_id}/shares", json={"email": VIEWER_EMAIL, "permission": "superadmin"})
rec("SHARE-08", "POST /trees/{id}/shares — invalid permission value",
    "PASS" if r.status_code in [400,409,422] else "FAIL",
    f"HTTP {r.status_code}")

# Share with non-existent user
r = seed_session.post(f"{BASE}/trees/{tree_id}/shares", json={"email": "ghost_nobody@nope.com", "permission": "viewer"})
rec("SHARE-09", "POST /trees/{id}/shares — non-existent user email",
    "PASS" if r.status_code in [400,404] else "FAIL",
    f"HTTP {r.status_code}: {r.json().get('detail','')}")

# Unauthenticated share
r = anon.post(f"{BASE}/trees/{tree_id}/shares", json={"email": VIEWER_EMAIL, "permission": "viewer"})
rec("SHARE-10", "POST /trees/{id}/shares — unauthenticated",
    "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code in [200,201])

# Share own tree with yourself
r = seed_session.post(f"{BASE}/trees/{tree_id}/shares", json={"email": SEED_EMAIL, "permission": "viewer"})
rec("SHARE-11", "POST /trees/{id}/shares — share with yourself (owner)",
    "PASS" if r.status_code in [400,409] else "FAIL",
    f"HTTP {r.status_code}: {r.json().get('detail','')}")

# Non-owner trying to share
r = viewer_session.post(f"{BASE}/trees/{tree_id}/shares", json={"email": "other@example.com", "permission": "viewer"})
rec("SHARE-12", "POST /trees/{id}/shares — non-owner trying to share",
    "PASS" if r.status_code in [401,403,404] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code in [200,201])

# PATCH /trees/{id}/shares/{sid}
if share_id:
    r = seed_session.patch(f"{BASE}/trees/{tree_id}/shares/{share_id}", json={"permission": "editor"})
    rec("SHARE-13", "PATCH /trees/{id}/shares/{sid} — valid role change to editor",
        "PASS" if r.status_code in [200,201] else "FAIL",
        f"HTTP {r.status_code}: permission={r.json().get('permission','') if r.status_code in [200,201] else r.text[:100]}")

    r = anon.patch(f"{BASE}/trees/{tree_id}/shares/{share_id}", json={"permission": "viewer"})
    rec("SHARE-14", "PATCH /trees/{id}/shares/{sid} — unauthenticated",
        "PASS" if r.status_code in [401,403] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code in [200,201])

    r = seed_session.patch(f"{BASE}/trees/{tree_id}/shares/{share_id}", json={"permission": "superadmin"})
    rec("SHARE-15", "PATCH /trees/{id}/shares/{sid} — invalid permission value",
        "PASS" if r.status_code in [400,422] else "FAIL",
        f"HTTP {r.status_code}")

    r = seed_session.patch(f"{BASE}/trees/{tree_id}/shares/{share_id}", json={})
    rec("SHARE-16", "PATCH /trees/{id}/shares/{sid} — empty body",
        "PASS" if r.status_code in [400,422] else "FAIL",
        f"HTTP {r.status_code}")

    r = seed_session.patch(f"{BASE}/trees/{tree_id}/shares/{NULL_UUID}", json={"permission": "viewer"})
    rec("SHARE-17", "PATCH /trees/{id}/shares/{sid} — not found share_id",
        "PASS" if r.status_code in [404,403] else "FAIL",
        f"HTTP {r.status_code}")

    # DELETE /trees/{id}/shares/{sid}
    r = anon.delete(f"{BASE}/trees/{tree_id}/shares/{share_id}")
    rec("SHARE-18", "DELETE /trees/{id}/shares/{sid} — unauthenticated",
        "PASS" if r.status_code in [401,403] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code in [200,204])

    r = viewer_session.delete(f"{BASE}/trees/{tree_id}/shares/{share_id}")
    rec("SHARE-19", "DELETE /trees/{id}/shares/{sid} — non-owner",
        "PASS" if r.status_code in [401,403,404] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code in [200,204])

    r = seed_session.delete(f"{BASE}/trees/{tree_id}/shares/{share_id}")
    rec("SHARE-20", "DELETE /trees/{id}/shares/{sid} — valid delete",
        "PASS" if r.status_code in [200,204] else "FAIL",
        f"HTTP {r.status_code}")

    r = seed_session.delete(f"{BASE}/trees/{tree_id}/shares/{share_id}")
    rec("SHARE-21", "DELETE /trees/{id}/shares/{sid} — delete again (already removed)",
        "PASS" if r.status_code in [404,400] else "FAIL",
        f"HTTP {r.status_code}")
else:
    for i in range(13, 22):
        rec(f"SHARE-{i}", f"Share sub-test {i}", "SKIP", "SHARE-05 failed — share_id not available")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 10: SHARING — Viewer Permission Tests")
print("="*60)

# Re-grant viewer access for permission tests
time.sleep(2)
seed_session, _ = login(SEED_EMAIL, SEED_PASS)
viewer_session, _ = login(VIEWER_EMAIL, VIEWER_PASS)
tree_id, people = get_tree(seed_session)

r = seed_session.post(f"{BASE}/trees/{tree_id}/shares", json={"email": VIEWER_EMAIL, "permission": "viewer"})
v_share_id = r.json().get("id") if r.status_code in [200,201] else None
if r.status_code in [200,201]:
    rec("VPERM-01", "Setup: Grant viewer access", "PASS", f"HTTP {r.status_code}")
else:
    rec("VPERM-01", "Setup: Grant viewer access", "FAIL", f"HTTP {r.status_code}: {r.text[:200]}")

# Viewer can read tree
r = viewer_session.get(f"{BASE}/trees/{tree_id}")
rec("VPERM-02", "Viewer GET /trees/{id} — should succeed (200)",
    "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code==403)

# Viewer can read people
r = viewer_session.get(f"{BASE}/people", params={"tree_id": tree_id})
rec("VPERM-03", "Viewer GET /people?tree_id — should succeed (200)",
    "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code==403)

# Viewer CANNOT create person
r = viewer_session.post(f"{BASE}/people", json={"name": "HackPerson"})
rec("VPERM-04", "Viewer POST /people — must be BLOCKED (403)",
    "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code in [200,201])

# Viewer CANNOT update tree
r = viewer_session.patch(f"{BASE}/trees/{tree_id}", json={"name": "ViewerHack"})
rec("VPERM-05", "Viewer PATCH /trees/{id} — must be BLOCKED (403)",
    "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code in [200,201])

# Viewer CANNOT share tree
r = viewer_session.post(f"{BASE}/trees/{tree_id}/shares", json={"email": "other@x.com", "permission": "viewer"})
rec("VPERM-06", "Viewer POST /trees/{id}/shares — must be BLOCKED",
    "PASS" if r.status_code in [401,403,404] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code in [200,201])

# Viewer CANNOT link people
if len(people) >= 2:
    r = viewer_session.post(f"{BASE}/people/link", json={
        "first_person_id": people[0]["id"], "second_person_id": people[1]["id"], "relationship_type": "spouse"
    })
    rec("VPERM-07", "Viewer POST /people/link — must be BLOCKED",
        "PASS" if r.status_code in [401,403] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code in [200,201])
else:
    rec("VPERM-07", "Viewer POST /people/link — must be BLOCKED", "SKIP", "Not enough people")

# Cleanup viewer share
if v_share_id:
    seed_session.delete(f"{BASE}/trees/{tree_id}/shares/{v_share_id}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 11: PEOPLE — Create")
print("="*60)

seed_session, _ = login(SEED_EMAIL, SEED_PASS)
tree_id, people = get_tree(seed_session)

r = seed_session.post(f"{BASE}/people", json={"name": "APITest Person", "gender": "male", "date_of_birth": "1990-06-15"})
new_person_id = None
if r.status_code in [200,201]:
    new_person_id = r.json().get("id")
    rec("PPL-01", "POST /people — valid person",
        "PASS", f"HTTP {r.status_code}: id={new_person_id}")
else:
    rec("PPL-01", "POST /people — valid person",
        "FAIL", f"HTTP {r.status_code}: {r.text[:200]}")

r = anon.post(f"{BASE}/people", json={"name": "Hack"})
rec("PPL-02", "POST /people — unauthenticated",
    "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code in [200,201])

r = seed_session.post(f"{BASE}/people", json={})
rec("PPL-03", "POST /people — empty body (missing name)",
    "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

# Invalid gender value
r = seed_session.post(f"{BASE}/people", json={"name": "Test", "gender": "cyborg"})
rec("PPL-04", "POST /people — invalid gender value",
    "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

# Death before birth
r = seed_session.post(f"{BASE}/people", json={"name": "BadDates", "date_of_birth": "2000-01-01", "date_of_death": "1990-01-01"})
if r.status_code in [400,422]:
    rec("PPL-05", "POST /people — death before birth", "PASS", f"HTTP {r.status_code}: validated correctly")
elif r.status_code in [200,201]:
    bad_id = r.json().get("id")
    rec("PPL-05", "POST /people — death before birth", "FAIL",
        f"HTTP {r.status_code}: ACCEPTED invalid dates! id={bad_id}", bug=True)
    seed_session.delete(f"{BASE}/people/{bad_id}")
else:
    rec("PPL-05", "POST /people — death before birth", "FAIL", f"HTTP {r.status_code}: {r.text[:200]}")

# Name too long
r = seed_session.post(f"{BASE}/people", json={"name": "X" * 200})
rec("PPL-06", "POST /people — name too long (>120 chars)",
    "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 12: PEOPLE — Read / Update / Delete")
print("="*60)

if new_person_id:
    r = seed_session.get(f"{BASE}/people/{new_person_id}")
    rec("PPL-07", "GET /people/{id} — valid",
        "PASS" if r.status_code == 200 else "FAIL",
        f"HTTP {r.status_code}: fields={list(r.json().keys()) if r.status_code==200 else r.text[:100]}")

    r = anon.get(f"{BASE}/people/{new_person_id}")
    rec("PPL-08", "GET /people/{id} — unauthenticated",
        "PASS" if r.status_code in [401,403] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code==200)

    r = viewer_session.get(f"{BASE}/people/{new_person_id}")
    rec("PPL-09", "GET /people/{id} — different user (no access)",
        "PASS" if r.status_code in [401,403,404] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code==200)

    r = seed_session.get(f"{BASE}/people/{NULL_UUID}")
    rec("PPL-10", "GET /people/{id} — null UUID not found",
        "PASS" if r.status_code in [404,403] else "FAIL",
        f"HTTP {r.status_code}")

    r = seed_session.get(f"{BASE}/people/not-a-uuid")
    rec("PPL-11", "GET /people/{id} — malformed UUID",
        "PASS" if r.status_code in [400,404,422] else "FAIL",
        f"HTTP {r.status_code}")

    r = seed_session.patch(f"{BASE}/people/{new_person_id}", json={"name": "APITest Updated"})
    rec("PPL-12", "PATCH /people/{id} — valid update",
        "PASS" if r.status_code in [200,201] else "FAIL",
        f"HTTP {r.status_code}: name={r.json().get('name','') if r.status_code in [200,201] else r.text[:100]}")

    r = anon.patch(f"{BASE}/people/{new_person_id}", json={"name": "HackUpdate"})
    rec("PPL-13", "PATCH /people/{id} — unauthenticated",
        "PASS" if r.status_code in [401,403] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code in [200,201])

    r = viewer_session.patch(f"{BASE}/people/{new_person_id}", json={"name": "ViewerHack"})
    rec("PPL-14", "PATCH /people/{id} — wrong user",
        "PASS" if r.status_code in [401,403,404] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code in [200,201])

    r = seed_session.patch(f"{BASE}/people/{new_person_id}", json={"gender": "invalid_value"})
    rec("PPL-15", "PATCH /people/{id} — invalid gender value",
        "PASS" if r.status_code in [400,422] else "FAIL",
        f"HTTP {r.status_code}")

    r = seed_session.patch(f"{BASE}/people/{NULL_UUID}", json={"name": "Ghost"})
    rec("PPL-16", "PATCH /people/{id} — not found",
        "PASS" if r.status_code in [404,403] else "FAIL",
        f"HTTP {r.status_code}")

    # Delete
    r = anon.delete(f"{BASE}/people/{new_person_id}")
    rec("PPL-17", "DELETE /people/{id} — unauthenticated",
        "PASS" if r.status_code in [401,403] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code in [200,204])

    r = viewer_session.delete(f"{BASE}/people/{new_person_id}")
    rec("PPL-18", "DELETE /people/{id} — wrong user",
        "PASS" if r.status_code in [401,403,404] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code in [200,204])

    r = seed_session.delete(f"{BASE}/people/{new_person_id}")
    rec("PPL-19", "DELETE /people/{id} — valid delete",
        "PASS" if r.status_code in [200,204] else "FAIL",
        f"HTTP {r.status_code}")

    r = seed_session.delete(f"{BASE}/people/{new_person_id}")
    rec("PPL-20", "DELETE /people/{id} — delete again (already deleted)",
        "PASS" if r.status_code in [404,400] else "FAIL",
        f"HTTP {r.status_code}")

    r = seed_session.delete(f"{BASE}/people/{NULL_UUID}")
    rec("PPL-21", "DELETE /people/{id} — not found",
        "PASS" if r.status_code in [404,403] else "FAIL",
        f"HTTP {r.status_code}")
else:
    for i in range(7, 22):
        rec(f"PPL-{i:02d}", f"People sub-test {i}", "SKIP", "PPL-01 failed — no person created")

# GET /people list
r = seed_session.get(f"{BASE}/people", params={"tree_id": tree_id})
rec("PPL-22", "GET /people?tree_id — valid",
    "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}: count={len(r.json()) if isinstance(r.json(),list) else '?'}")

r = anon.get(f"{BASE}/people", params={"tree_id": tree_id})
rec("PPL-23", "GET /people?tree_id — unauthenticated",
    "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code==200)

r = seed_session.get(f"{BASE}/people")
rec("PPL-24", "GET /people — no tree_id param",
    "PASS" if r.status_code in [200,400,422] else "FAIL",
    f"HTTP {r.status_code}: {r.text[:100]}")

r = seed_session.get(f"{BASE}/people", params={"tree_id": NULL_UUID})
rec("PPL-25", "GET /people?tree_id=null_uuid — not found",
    "PASS" if r.status_code in [200,403,404] else "FAIL",
    f"HTTP {r.status_code}: {r.json() if r.status_code in [200,403,404] else r.text[:100]}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 13: PEOPLE — Link (Relationships)")
print("="*60)

seed_session, _ = login(SEED_EMAIL, SEED_PASS)
tree_id, people = get_tree(seed_session)

if len(people) >= 2:
    p1_id = people[0]["id"]
    p2_id = people[1]["id"]
    p1_name = people[0].get("name", "?")
    p2_name = people[1].get("name", "?")
    print(f"  Using: {p1_name} and {p2_name}")

    r = seed_session.post(f"{BASE}/people/link", json={
        "first_person_id": p1_id, "second_person_id": p2_id, "relationship_type": "spouse"
    })
    rec("LINK-01", "POST /people/link — valid spouse link",
        "PASS" if r.status_code in [200,201,409] else "FAIL",
        f"HTTP {r.status_code}: {r.json() if r.status_code != 409 else 'already exists'}")

    r = anon.post(f"{BASE}/people/link", json={
        "first_person_id": p1_id, "second_person_id": p2_id, "relationship_type": "spouse"
    })
    rec("LINK-02", "POST /people/link — unauthenticated",
        "PASS" if r.status_code in [401,403] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code in [200,201])

    r = seed_session.post(f"{BASE}/people/link", json={
        "first_person_id": p1_id, "second_person_id": p1_id, "relationship_type": "spouse"
    })
    rec("LINK-03", "POST /people/link — self-link (same person)",
        "PASS" if r.status_code in [400,422,409] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code in [200,201])

    r = seed_session.post(f"{BASE}/people/link", json={
        "first_person_id": NULL_UUID, "second_person_id": p2_id, "relationship_type": "spouse"
    })
    rec("LINK-04", "POST /people/link — invalid first_person_id (null UUID)",
        "PASS" if r.status_code in [400,404,422] else "FAIL",
        f"HTTP {r.status_code}")

    r = seed_session.post(f"{BASE}/people/link", json={
        "first_person_id": p1_id, "second_person_id": NULL_UUID, "relationship_type": "spouse"
    })
    rec("LINK-05", "POST /people/link — invalid second_person_id (null UUID)",
        "PASS" if r.status_code in [400,404,422] else "FAIL",
        f"HTTP {r.status_code}")

    r = seed_session.post(f"{BASE}/people/link", json={
        "first_person_id": p1_id, "second_person_id": p2_id, "relationship_type": "parent"
    })
    rec("LINK-06", "POST /people/link — parent type (only spouse supported)",
        "PASS" if r.status_code in [200,201,400,409] else "FAIL",
        f"HTTP {r.status_code}: {r.json().get('detail','') if r.status_code not in [200,201] else 'ok'}")

    r = seed_session.post(f"{BASE}/people/link", json={
        "first_person_id": p1_id, "second_person_id": p2_id, "relationship_type": "sibling"
    })
    rec("LINK-07", "POST /people/link — sibling type",
        "PASS" if r.status_code in [200,201,400,409] else "FAIL",
        f"HTTP {r.status_code}: {r.json().get('detail','') if r.status_code not in [200,201] else 'ok'}")

    r = seed_session.post(f"{BASE}/people/link", json={
        "first_person_id": p1_id, "second_person_id": p2_id, "relationship_type": "invalid_type"
    })
    rec("LINK-08", "POST /people/link — invalid relationship_type",
        "PASS" if r.status_code in [400,422] else "FAIL",
        f"HTTP {r.status_code}")

    r = seed_session.post(f"{BASE}/people/link", json={"first_person_id": p1_id})
    rec("LINK-09", "POST /people/link — missing second_person_id",
        "PASS" if r.status_code in [400,422] else "FAIL",
        f"HTTP {r.status_code}")

    r = seed_session.post(f"{BASE}/people/link", json={})
    rec("LINK-10", "POST /people/link — empty body",
        "PASS" if r.status_code in [400,422] else "FAIL",
        f"HTTP {r.status_code}")

    # Wrong user trying to link people in seed's tree
    r = viewer_session.post(f"{BASE}/people/link", json={
        "first_person_id": p1_id, "second_person_id": p2_id, "relationship_type": "spouse"
    })
    rec("LINK-11", "POST /people/link — wrong user (viewer, no ownership)",
        "PASS" if r.status_code in [401,403,404] else "FAIL",
        f"HTTP {r.status_code}", bug=r.status_code in [200,201])
else:
    for i in range(1, 12):
        rec(f"LINK-{i:02d}", f"Link sub-test {i}", "SKIP", f"Not enough people (need 2, found {len(people)})")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 14: /families/trees (duplicate routes)")
print("="*60)

seed_session, _ = login(SEED_EMAIL, SEED_PASS)
tree_id, _ = get_tree(seed_session)

r = seed_session.get(f"{BASE}/families/trees")
rec("FAM-01", "GET /families/trees — authenticated",
    "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}: keys={list(r.json().keys()) if isinstance(r.json(),dict) else type(r.json()).__name__}")

r = anon.get(f"{BASE}/families/trees")
rec("FAM-02", "GET /families/trees — unauthenticated",
    "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code==200)

r = seed_session.get(f"{BASE}/families/trees/{tree_id}")
rec("FAM-03", "GET /families/trees/{id} — valid",
    "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}")

r = seed_session.get(f"{BASE}/families/trees/{NULL_UUID}")
rec("FAM-04", "GET /families/trees/{id} — not found",
    "PASS" if r.status_code in [404,403] else "FAIL",
    f"HTTP {r.status_code}")

r = seed_session.get(f"{BASE}/families/trees/{tree_id}/activities")
rec("FAM-05", "GET /families/trees/{id}/activities — valid",
    "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}")

r = seed_session.get(f"{BASE}/families/trees/{tree_id}/shares")
rec("FAM-06", "GET /families/trees/{id}/shares — valid",
    "PASS" if r.status_code == 200 else "FAIL",
    f"HTTP {r.status_code}")

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("SECTION 15: SUPPORT")
print("="*60)

seed_session, _ = login(SEED_EMAIL, SEED_PASS)

r = seed_session.post(f"{BASE}/support", json={"subject": "Test", "message": "API test query"})
rec("SUP-01", "POST /support — authenticated valid",
    "PASS" if r.status_code in [200,201] else "FAIL",
    f"HTTP {r.status_code}: {r.json().get('message','') if r.status_code in [200,201] else r.text[:200]}")

r = anon.post(f"{BASE}/support", json={"subject": "Test", "message": "Anon test"})
rec("SUP-02", "POST /support — unauthenticated",
    "PASS" if r.status_code in [401,403] else "FAIL",
    f"HTTP {r.status_code}", bug=r.status_code in [200,201])

r = seed_session.post(f"{BASE}/support", json={})
rec("SUP-03", "POST /support — empty body",
    "PASS" if r.status_code in [400,422] else "FAIL",
    f"HTTP {r.status_code}")

r = seed_session.post(f"{BASE}/support", json={"subject": "Only subject no message"})
rec("SUP-04", "POST /support — missing message",
    "PASS" if r.status_code in [200,201,400,422] else "FAIL",
    f"HTTP {r.status_code}: {r.text[:100]}")

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("FINAL SUMMARY")
print("="*60)

passed  = [r for r in results if r["result"] == "PASS"]
failed  = [r for r in results if r["result"] == "FAIL"]
skipped = [r for r in results if r["result"] == "SKIP"]
bugs    = [r for r in results if r["bug"]]
total   = len(results)
testable = total - len(skipped)

print(f"\n{'ID':<12} {'Test':<55} {'Result'}")
print("-" * 80)
for r in results:
    flag = " [BUG]" if r["bug"] else ""
    icon = "PASS" if r["result"] == "PASS" else ("SKIP" if r["result"] == "SKIP" else "FAIL")
    print(f"{r['id']:<12} {r['name']:<55} {icon}{flag}")

print("\n" + "="*60)
print(f"TOTAL: {total} | PASS: {len(passed)} | FAIL: {len(failed)} | SKIP: {len(skipped)}")
if testable > 0:
    print(f"Pass rate (excl. skipped): {len(passed)}/{testable} = {int(len(passed)/testable*100)}%")
if bugs:
    print(f"\nCONFIRMED BUGS ({len(bugs)}):")
    for b in bugs:
        print(f"  [BUG] {b['id']}: {b['name']}")
        print(f"        {b['obs']}")

with open("docs/testing/api_test_results.json", "w") as f:
    json.dump({"summary": {"total": total, "passed": len(passed), "failed": len(failed), "skipped": len(skipped), "bugs": len(bugs)},
               "results": results}, f, indent=2)
print("\nResults saved -> docs/testing/api_test_results.json")
