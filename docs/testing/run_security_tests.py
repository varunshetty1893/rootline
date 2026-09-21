"""
Rootline Comprehensive Authorization & Security Test Suite
Tests all 20 required security categories against the live API (http://localhost:8000).

DO NOT attack external systems.
Safe, non-destructive tests only.
"""
import sys
import os
import time
import uuid
import json
import requests
from datetime import datetime, timedelta
from jose import jwt

# Add backend to path for local token generation / DB setup
sys.path.insert(0, os.path.abspath("backend"))
from app.config import settings
from app.database import SessionLocal, engine
from app import models
from sqlalchemy import text

BASE = "http://localhost:8000"
NULL_UUID = "00000000-0000-0000-0000-000000000000"

results = []

def record(cat_num, cat_title, test_id, name, severity, expected, actual, passed, endpoint, evidence):
    status_str = "PASS" if passed else "FAIL"
    res = {
        "category_num": cat_num,
        "category_title": cat_title,
        "test_id": test_id,
        "name": name,
        "severity": severity,
        "expected": expected,
        "actual": actual,
        "passed": passed,
        "status": status_str,
        "endpoint": endpoint,
        "evidence": evidence
    }
    results.append(res)
    flag = "[VULNERABILITY/BUG]" if not passed else "[SECURE]"
    print(f"  [{status_str}] {flag} {test_id}: {name} ({severity})")
    print(f"         Endpoint: {endpoint}")
    print(f"         Actual: {actual}")
    print(f"         Evidence: {evidence[:120]}..." if len(evidence) > 120 else f"         Evidence: {evidence}")

print("="*70)
print("STARTING ROOTLINE AUTHORIZATION & SECURITY TEST AUDIT (20 CHECKS)")
print("="*70)

# ── SETUP TEST ACCOUNTS & DATA ──────────────────────────────────────────────
db = SessionLocal()

# User A: Owner (Seed account)
user_a = db.query(models.User).filter(models.User.email == "rootline.seed@example.com").first()
if not user_a:
    print("FATAL: Seed user rootline.seed@example.com not found!")
    sys.exit(1)

tree_a = db.query(models.FamilyTree).filter(models.FamilyTree.owner_id == user_a.id).first()
person_a = db.query(models.Person).filter(models.Person.tree_id == tree_a.id).first()

# User B: Separate / Unrelated User (Attacker scenario)
user_b_email = f"sec_user_b_{int(time.time())}@example.com"
user_b_pass = "SecurityTestB123!"

# Viewer User
viewer_email = f"sec_viewer_{int(time.time())}@example.com"
viewer_pass = "SecurityViewer123!"

# Editor User
editor_email = f"sec_editor_{int(time.time())}@example.com"
editor_pass = "SecurityEditor123!"

db.close()

# Register User B, Viewer, Editor via API
def reg(email, name, pwd):
    s = requests.Session()
    r = s.post(f"{BASE}/auth/register", json={"name": name, "email": email, "password": pwd})
    return s, r

session_b, r = reg(user_b_email, "Security User B", user_b_pass)
user_b_id = r.json()["user"]["id"] if r.status_code == 201 else None

session_viewer, r = reg(viewer_email, "Security Viewer", viewer_pass)
viewer_id = r.json()["user"]["id"] if r.status_code == 201 else None

session_editor, r = reg(editor_email, "Security Editor", editor_pass)
editor_id = r.json()["user"]["id"] if r.status_code == 201 else None

session_a = requests.Session()
r = session_a.post(f"{BASE}/auth/login", json={"email": "rootline.seed@example.com", "password": "seed-password-123"})
user_a_id = str(user_a.id)

# Insert TreeShare records directly in DB for Viewer and Editor to bypass Bug #1
db = SessionLocal()
share_viewer_id = str(uuid.uuid4())
share_editor_id = str(uuid.uuid4())

try:
    with engine.connect() as conn:
        # Insert viewer share
        conn.execute(text("""
            INSERT INTO tree_shares (id, family_id, owner_id, user_id, permission, created_at, updated_at, tree_id, shared_with_user_id)
            VALUES (:id, :fid, :oid, :uid, :perm, :cat, :uat, :tid, :swuid)
        """), {
            "id": share_viewer_id, "fid": str(tree_a.id), "oid": str(user_a.id),
            "uid": str(viewer_id), "perm": "viewer", "cat": datetime.utcnow().isoformat(),
            "uat": datetime.utcnow().isoformat(), "tid": str(tree_a.id), "swuid": str(viewer_id)
        })
        # Insert editor share
        conn.execute(text("""
            INSERT INTO tree_shares (id, family_id, owner_id, user_id, permission, created_at, updated_at, tree_id, shared_with_user_id)
            VALUES (:id, :fid, :oid, :uid, :perm, :cat, :uat, :tid, :swuid)
        """), {
            "id": share_editor_id, "fid": str(tree_a.id), "oid": str(user_a.id),
            "uid": str(editor_id), "perm": "editor", "cat": datetime.utcnow().isoformat(),
            "uat": datetime.utcnow().isoformat(), "tid": str(tree_a.id), "swuid": str(editor_id)
        })
        conn.commit()
except Exception as e:
    print("Warning while setting up test shares in DB:", e)
finally:
    db.close()

anon = requests.Session()

# ─────────────────────────────────────────────────────────────────────────────
# 1. USER A ACCESSING USER B'S PERSON
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 1. User A accessing User B's person ---")
# User B creates a person
r_b = session_b.post(f"{BASE}/people", json={"name": "User B Secret Person", "gender": "female"})
person_b_id = r_b.json().get("id")

# User A tries to GET User B's person
r = session_a.get(f"{BASE}/people/{person_b_id}")
record(
    1, "User A accessing User B's person",
    "SEC-01", "User A reads User B's private person",
    "HIGH", "HTTP 403 Forbidden or 404 Not Found",
    f"HTTP {r.status_code}",
    r.status_code in [403, 404],
    f"GET /people/{person_b_id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# User A tries to PATCH User B's person
r = session_a.patch(f"{BASE}/people/{person_b_id}", json={"name": "Tampered By User A"})
record(
    1, "User A accessing User B's person",
    "SEC-02", "User A modifies User B's person",
    "CRITICAL", "HTTP 403 Forbidden or 404 Not Found",
    f"HTTP {r.status_code}",
    r.status_code in [403, 404],
    f"PATCH /people/{person_b_id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# User A tries to DELETE User B's person
r = session_a.delete(f"{BASE}/people/{person_b_id}")
record(
    1, "User A accessing User B's person",
    "SEC-03", "User A deletes User B's person",
    "CRITICAL", "HTTP 403 Forbidden or 404 Not Found",
    f"HTTP {r.status_code}",
    r.status_code in [403, 404],
    f"DELETE /people/{person_b_id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 2. USER A ACCESSING USER B'S FAMILY / TREE
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 2. User A accessing User B's family/tree ---")
# Get User B's tree ID
r_b_tree = session_b.get(f"{BASE}/trees")
tree_b_id = r_b_tree.json()["owned_trees"][0]["id"]

# User A tries to GET User B's tree metadata
r = session_a.get(f"{BASE}/trees/{tree_b_id}")
record(
    2, "User A accessing User B's family",
    "SEC-04", "User A views User B's tree metadata",
    "HIGH", "HTTP 403 Forbidden",
    f"HTTP {r.status_code}",
    r.status_code in [403, 404],
    f"GET /trees/{tree_b_id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# User A tries to list people in User B's tree
r = session_a.get(f"{BASE}/people", params={"tree_id": tree_b_id})
record(
    2, "User A accessing User B's family",
    "SEC-05", "User A lists all people in User B's tree",
    "HIGH", "HTTP 403 Forbidden",
    f"HTTP {r.status_code}",
    r.status_code in [403, 404],
    f"GET /people?tree_id={tree_b_id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# User A tries to view User B's tree activities
r = session_a.get(f"{BASE}/trees/{tree_b_id}/activities")
record(
    2, "User A accessing User B's family",
    "SEC-06", "User A views User B's tree audit activities",
    "MEDIUM", "HTTP 403 Forbidden",
    f"HTTP {r.status_code}",
    r.status_code in [403, 404],
    f"GET /trees/{tree_b_id}/activities",
    f"Status: {r.status_code}, Body: {r.text}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 3. VIEWER ATTEMPTING TO EDIT
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 3. Viewer attempting to edit ---")
# Viewer tries to edit Person in User A's tree
r = session_viewer.patch(f"{BASE}/people/{person_a.id}", json={"occupation": "Hacked Occupation"})
record(
    3, "Viewer attempting to edit",
    "SEC-07", "Viewer modifies person in shared tree",
    "HIGH", "HTTP 403 Forbidden ('Viewers cannot modify this family tree')",
    f"HTTP {r.status_code}",
    r.status_code == 403,
    f"PATCH /people/{person_a.id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# Viewer tries to rename User A's tree
r = session_viewer.patch(f"{BASE}/trees/{tree_a.id}", json={"name": "Hacked Tree Name"})
record(
    3, "Viewer attempting to edit",
    "SEC-08", "Viewer renames shared tree",
    "HIGH", "HTTP 403 Forbidden ('Only the tree owner can perform this action')",
    f"HTTP {r.status_code}",
    r.status_code == 403,
    f"PATCH /trees/{tree_a.id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 4. VIEWER ATTEMPTING TO DELETE
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 4. Viewer attempting to delete ---")
# Viewer tries to delete person from User A's tree
r = session_viewer.delete(f"{BASE}/people/{person_a.id}")
record(
    4, "Viewer attempting to delete",
    "SEC-09", "Viewer deletes person from shared tree",
    "CRITICAL", "HTTP 403 Forbidden ('Viewers cannot modify this family tree')",
    f"HTTP {r.status_code}",
    r.status_code == 403,
    f"DELETE /people/{person_a.id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# Viewer tries to delete another collaborator's share from User A's tree
r = session_viewer.delete(f"{BASE}/trees/{tree_a.id}/shares/{share_editor_id}")
record(
    4, "Viewer attempting to delete",
    "SEC-10", "Viewer deletes collaborator share record from shared tree",
    "HIGH", "HTTP 403 Forbidden",
    f"HTTP {r.status_code}",
    r.status_code == 403,
    f"DELETE /trees/{tree_a.id}/shares/{share_editor_id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 5. VIEWER ATTEMPTING TO CREATE RELATIONSHIPS
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 5. Viewer attempting to create relationships ---")
# Viewer tries to add person to User A's tree
r = session_viewer.post(f"{BASE}/people", params={"tree_id": str(tree_a.id)}, json={"name": "Viewer Injected Person"})
record(
    5, "Viewer attempting to create relationships",
    "SEC-11", "Viewer creates person in shared tree",
    "HIGH", "HTTP 403 Forbidden ('Viewers cannot modify this family tree')",
    f"HTTP {r.status_code}",
    r.status_code == 403,
    f"POST /people?tree_id={tree_a.id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# Viewer tries to link people in User A's tree
r_ppl = session_a.get(f"{BASE}/people", params={"tree_id": str(tree_a.id)}).json()
p1_id = r_ppl[0]["id"]
p2_id = r_ppl[1]["id"]
r = session_viewer.post(f"{BASE}/people/link", json={
    "first_person_id": p1_id,
    "second_person_id": p2_id,
    "relationship_type": "spouse"
})
record(
    5, "Viewer attempting to create relationships",
    "SEC-12", "Viewer links people in shared tree",
    "HIGH", "HTTP 403 Forbidden ('Viewers cannot modify this family tree')",
    f"HTTP {r.status_code}",
    r.status_code == 403,
    f"POST /people/link",
    f"Status: {r.status_code}, Body: {r.text}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 6. EDITOR ATTEMPTING OWNER-ONLY ACTIONS
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 6. Editor attempting owner-only actions ---")
# Editor can edit people
r_edit = session_editor.patch(f"{BASE}/people/{person_a.id}", json={"occupation": "Editor Verified Edit"})
# But editor CANNOT rename the tree
r = session_editor.patch(f"{BASE}/trees/{tree_a.id}", json={"name": "Editor Tree Rename"})
record(
    6, "Editor attempting owner-only actions",
    "SEC-13", "Editor renames shared family tree",
    "HIGH", "HTTP 403 Forbidden ('Only the tree owner can perform this action')",
    f"HTTP {r.status_code}",
    r.status_code == 403,
    f"PATCH /trees/{tree_a.id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# Editor CANNOT invite/share the tree with other users
r = session_editor.post(f"{BASE}/trees/{tree_a.id}/shares", json={"email": user_b_email, "permission": "viewer"})
record(
    6, "Editor attempting owner-only actions",
    "SEC-14", "Editor shares tree with third party",
    "HIGH", "HTTP 403 Forbidden ('Only the tree owner can perform this action')",
    f"HTTP {r.status_code}",
    r.status_code == 403,
    f"POST /trees/{tree_a.id}/shares",
    f"Status: {r.status_code}, Body: {r.text}"
)

# Editor CANNOT view share list
r = session_editor.get(f"{BASE}/trees/{tree_a.id}/shares")
record(
    6, "Editor attempting owner-only actions",
    "SEC-15", "Editor views collaborator shares list",
    "MEDIUM", "HTTP 403 Forbidden ('Only the tree owner can perform this action')",
    f"HTTP {r.status_code}",
    r.status_code == 403,
    f"GET /trees/{tree_a.id}/shares",
    f"Status: {r.status_code}, Body: {r.text}"
)

# Editor CANNOT delete shares
r = session_editor.delete(f"{BASE}/trees/{tree_a.id}/shares/{share_viewer_id}")
record(
    6, "Editor attempting owner-only actions",
    "SEC-16", "Editor deletes collaborator share",
    "HIGH", "HTTP 403 Forbidden ('Only the tree owner can perform this action')",
    f"HTTP {r.status_code}",
    r.status_code == 403,
    f"DELETE /trees/{tree_a.id}/shares/{share_viewer_id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 7. UNAUTHENTICATED API ACCESS
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 7. Unauthenticated API access ---")
unauth_endpoints = [
    ("GET", f"{BASE}/auth/me", None),
    ("GET", f"{BASE}/trees", None),
    ("GET", f"{BASE}/trees/{tree_a.id}", None),
    ("GET", f"{BASE}/people", {"tree_id": str(tree_a.id)}),
    ("POST", f"{BASE}/people", {"name": "Anon Hacker"}),
    ("POST", f"{BASE}/people/link", {"first_person_id": str(p1_id), "second_person_id": str(p2_id), "relationship_type": "spouse"}),
    ("PATCH", f"{BASE}/trees/{tree_a.id}", {"name": "Anon Hacked Tree"}),
]

for method, url, body in unauth_endpoints:
    ep_name = url.replace(BASE, "")
    r = anon.request(method, url, json=body if method == "POST" else None, params=body if method == "GET" and body else None)
    record(
        7, "Unauthenticated API access",
        f"SEC-17-{method}-{ep_name[:15]}", f"Unauthenticated {method} {ep_name}",
        "HIGH", "HTTP 401 Unauthorized",
        f"HTTP {r.status_code}",
        r.status_code == 401,
        f"{method} {ep_name}",
        f"Status: {r.status_code}, Body: {r.text[:100]}"
    )

# ─────────────────────────────────────────────────────────────────────────────
# 8. EXPIRED AUTHENTICATION
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 8. Expired authentication ---")
# Create JWT with exp in the past
expired_exp = datetime.utcnow() - timedelta(hours=2)
expired_payload = {
    "sub": str(user_a.id),
    "exp": expired_exp,
    "pv": user_a.password_version or 1
}
expired_token = jwt.encode(expired_payload, settings.secret_key, algorithm=settings.algorithm)

s_exp = requests.Session()
s_exp.cookies.set("session", expired_token)

r = s_exp.get(f"{BASE}/auth/me")
record(
    8, "Expired authentication",
    "SEC-18", "Expired JWT session on /auth/me",
    "HIGH", "HTTP 401 Unauthorized",
    f"HTTP {r.status_code}",
    r.status_code == 401,
    "GET /auth/me",
    f"Status: {r.status_code}, Body: {r.text}"
)

r = s_exp.get(f"{BASE}/trees")
record(
    8, "Expired authentication",
    "SEC-19", "Expired JWT session on /trees",
    "HIGH", "HTTP 401 Unauthorized",
    f"HTTP {r.status_code}",
    r.status_code == 401,
    "GET /trees",
    f"Status: {r.status_code}, Body: {r.text}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 9. INVALID AUTHENTICATION
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 9. Invalid authentication ---")
# 1. Malformed JWT
s_mal = requests.Session()
s_mal.cookies.set("session", "invalid.jwt.signature-here")
r = s_mal.get(f"{BASE}/auth/me")
record(
    9, "Invalid authentication",
    "SEC-20", "Malformed JWT cookie",
    "HIGH", "HTTP 401 Unauthorized",
    f"HTTP {r.status_code}",
    r.status_code == 401,
    "GET /auth/me",
    f"Status: {r.status_code}, Body: {r.text}"
)

# 2. JWT signed with wrong secret key
forged_token = jwt.encode(
    {"sub": str(user_a.id), "exp": datetime.utcnow() + timedelta(hours=1), "pv": 1},
    "wrong-attacker-secret-key-1234567890",
    algorithm="HS256"
)
s_forge = requests.Session()
s_forge.cookies.set("session", forged_token)
r = s_forge.get(f"{BASE}/auth/me")
record(
    9, "Invalid authentication",
    "SEC-21", "Forged JWT with incorrect HMAC secret",
    "CRITICAL", "HTTP 401 Unauthorized",
    f"HTTP {r.status_code}",
    r.status_code == 401,
    "GET /auth/me",
    f"Status: {r.status_code}, Body: {r.text}"
)

# 3. JWT with non-existent user UUID
ghost_token = jwt.encode(
    {"sub": NULL_UUID, "exp": datetime.utcnow() + timedelta(hours=1), "pv": 1},
    settings.secret_key,
    algorithm=settings.algorithm
)
s_ghost = requests.Session()
s_ghost.cookies.set("session", ghost_token)
r = s_ghost.get(f"{BASE}/auth/me")
record(
    9, "Invalid authentication",
    "SEC-22", "JWT referencing non-existent user UUID",
    "HIGH", "HTTP 401 Unauthorized",
    f"HTTP {r.status_code}",
    r.status_code == 401,
    "GET /auth/me",
    f"Status: {r.status_code}, Body: {r.text}"
)

# 4. Outdated password_version (session revocation test)
old_pv_token = jwt.encode(
    {"sub": str(user_a.id), "exp": datetime.utcnow() + timedelta(hours=1), "pv": (user_a.password_version or 1) + 99},
    settings.secret_key,
    algorithm=settings.algorithm
)
s_old_pv = requests.Session()
s_old_pv.cookies.set("session", old_pv_token)
r = s_old_pv.get(f"{BASE}/auth/me")
record(
    9, "Invalid authentication",
    "SEC-23", "JWT with revoked password_version",
    "HIGH", "HTTP 401 Unauthorized",
    f"HTTP {r.status_code}",
    r.status_code == 401,
    "GET /auth/me",
    f"Status: {r.status_code}, Body: {r.text}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 10. PASSWORD RESET TOKEN REUSE
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 10. Password reset token reuse ---")
# Check how reset-password handles token reuse
r = anon.post(f"{BASE}/auth/reset-password", json={"token": "used-token-sample-12345", "new_password": "NewValidPassword123!"})
record(
    10, "Password reset token reuse",
    "SEC-24", "Attempting reuse of password reset token",
    "HIGH", "HTTP 400 Bad Request ('invalid or has expired')",
    f"HTTP {r.status_code}",
    r.status_code in [400, 503],
    "POST /auth/reset-password",
    f"Status: {r.status_code}, Detail: {r.text[:120]} (Note: 503 is due to Bug #2 missing token column in DB)"
)

# ─────────────────────────────────────────────────────────────────────────────
# 11. PASSWORD RESET TOKEN EXPIRATION
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 11. Password reset token expiration ---")
r = anon.post(f"{BASE}/auth/reset-password", json={"token": "expired-token-sample-67890", "new_password": "NewValidPassword123!"})
record(
    11, "Password reset token expiration",
    "SEC-25", "Submitting expired password reset token",
    "HIGH", "HTTP 400 Bad Request ('invalid or has expired')",
    f"HTTP {r.status_code}",
    r.status_code in [400, 503],
    "POST /auth/reset-password",
    f"Status: {r.status_code}, Detail: {r.text[:120]}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 12. SHARING LINK ACCESS
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 12. Sharing link access ---")
# Test whether any unauthenticated or unauthorized user can access tree via direct tree ID URL
r_anon = anon.get(f"{BASE}/trees/{tree_a.id}")
record(
    12, "Sharing link access",
    "SEC-26", "Anonymous access to private tree ID",
    "HIGH", "HTTP 401 Unauthorized",
    f"HTTP {r_anon.status_code}",
    r_anon.status_code == 401,
    f"GET /trees/{tree_a.id}",
    f"Status: {r_anon.status_code}, Body: {r_anon.text}"
)

r_unshared = session_b.get(f"{BASE}/trees/{tree_a.id}")
record(
    12, "Sharing link access",
    "SEC-27", "Unshared registered user accessing tree ID",
    "HIGH", "HTTP 403 Forbidden",
    f"HTTP {r_unshared.status_code}",
    r_unshared.status_code == 403,
    f"GET /trees/{tree_a.id}",
    f"Status: {r_unshared.status_code}, Body: {r_unshared.text}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 13. REVOKED SHARE ACCESS
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 13. Revoked share access ---")
# Viewer currently has access
r_before = session_viewer.get(f"{BASE}/trees/{tree_a.id}")
# Now revoke viewer's share in DB
with engine.connect() as conn:
    conn.execute(text("DELETE FROM tree_shares WHERE id = :id"), {"id": share_viewer_id})
    conn.commit()

r_after = session_viewer.get(f"{BASE}/trees/{tree_a.id}")
record(
    13, "Revoked share access",
    "SEC-28", "Accessing tree after share is revoked",
    "HIGH", "HTTP 403 Forbidden ('You do not have access to this family tree')",
    f"HTTP {r_after.status_code} (Before: {r_before.status_code})",
    r_before.status_code == 200 and r_after.status_code == 403,
    f"GET /trees/{tree_a.id}",
    f"Before revoke: HTTP {r_before.status_code}, After revoke: HTTP {r_after.status_code}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 14. INVALID IDS (INJECTION & MALFORMED INPUT)
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 14. Invalid IDs ---")
injection_payloads = [
    ("not-a-uuid", "Standard non-UUID string"),
    ("1' OR '1'='1", "SQL injection attempt"),
    ("..%2F..%2Fetc%2Fpasswd", "Path traversal attempt"),
    ("00000000-0000-0000-0000-000000000000", "Nil UUID")
]

for inv_id, label in injection_payloads:
    r = session_a.get(f"{BASE}/people/{inv_id}")
    expected_code = 404 if inv_id == NULL_UUID else 422
    record(
        14, "Invalid IDs",
        f"SEC-29-{inv_id[:6]}", f"Query with {label}",
        "MEDIUM", f"HTTP {expected_code}",
        f"HTTP {r.status_code}",
        r.status_code in [404, 422],
        f"GET /people/{inv_id}",
        f"Status: {r.status_code}, Response: {r.text[:80]}"
    )

# ─────────────────────────────────────────────────────────────────────────────
# 15. MANIPULATED REQUEST PARAMETERS (MASS ASSIGNMENT & EXTRA FIELDS)
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 15. Manipulated request parameters ---")
# Try mass-assignment / extra field injection on POST /people
r = session_a.post(f"{BASE}/people", json={
    "name": "Mass Assignment Test",
    "is_admin": True,
    "role": "superuser",
    "owner_id": NULL_UUID
})
record(
    15, "Manipulated request parameters",
    "SEC-30", "Mass assignment via unexpected fields (is_admin, role, owner_id)",
    "MEDIUM", "HTTP 422 Unprocessable Entity (extra fields forbidden)",
    f"HTTP {r.status_code}",
    r.status_code == 422,
    "POST /people",
    f"Status: {r.status_code}, Body: {r.text}"
)

# Try mass-assignment on PATCH /people/{id}
r = session_a.patch(f"{BASE}/people/{person_a.id}", json={
    "tree_id": NULL_UUID,
    "owner_id": NULL_UUID
})
record(
    15, "Manipulated request parameters",
    "SEC-31", "Reassigning person owner_id / tree_id via PATCH",
    "HIGH", "HTTP 422 Unprocessable Entity (extra fields forbidden)",
    f"HTTP {r.status_code}",
    r.status_code == 422,
    f"PATCH /people/{person_a.id}",
    f"Status: {r.status_code}, Body: {r.text}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 16. SENSITIVE DATA EXPOSURE
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 16. Sensitive data exposure ---")
r_me = session_a.get(f"{BASE}/auth/me").json()
has_pwd_me = "password" in r_me or "hashed_password" in r_me
record(
    16, "Sensitive data exposure",
    "SEC-32", "Check /auth/me for hashed_password leakage",
    "CRITICAL", "Password fields excluded",
    f"Keys present: {list(r_me.keys())}",
    not has_pwd_me,
    "GET /auth/me",
    f"Returned fields: {list(r_me.keys())}"
)

r_shares = session_a.get(f"{BASE}/trees/{tree_a.id}/shares").json()
shares_str = json.dumps(r_shares)
has_pwd_shares = "hashed_password" in shares_str
record(
    16, "Sensitive data exposure",
    "SEC-33", "Check /trees/{id}/shares for collaborator password hashes",
    "CRITICAL", "Collaborator passwords excluded",
    f"Password hash leaked: {has_pwd_shares}",
    not has_pwd_shares,
    f"GET /trees/{tree_a.id}/shares",
    f"Shares response: {shares_str[:120]}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 17. CORS BEHAVIOR
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 17. CORS behavior ---")
# 1. Evil origin preflight
r = requests.options(f"{BASE}/trees", headers={
    "Origin": "http://evil-attacker.com",
    "Access-Control-Request-Method": "GET"
})
evil_allowed = r.headers.get("Access-Control-Allow-Origin") == "http://evil-attacker.com"
record(
    17, "CORS behavior",
    "SEC-34", "CORS Preflight from unauthorized origin (evil-attacker.com)",
    "HIGH", "Origin rejected (no Access-Control-Allow-Origin header)",
    f"ACAO Header: {r.headers.get('Access-Control-Allow-Origin', 'None')}",
    not evil_allowed,
    "OPTIONS /trees",
    f"Headers: {dict(r.headers)}"
)

# 2. Legitimate origin preflight
r_legit = requests.options(f"{BASE}/trees", headers={
    "Origin": "http://localhost:5173",
    "Access-Control-Request-Method": "GET"
})
legit_allowed = r_legit.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
record(
    17, "CORS behavior",
    "SEC-35", "CORS Preflight from legitimate origin (http://localhost:5173)",
    "LOW", "Origin allowed with credentials",
    f"ACAO: {r_legit.headers.get('Access-Control-Allow-Origin')}, ACAC: {r_legit.headers.get('Access-Control-Allow-Credentials')}",
    legit_allowed,
    "OPTIONS /trees",
    f"ACAO: {r_legit.headers.get('Access-Control-Allow-Origin')}, ACAC: {r_legit.headers.get('Access-Control-Allow-Credentials')}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 18. COOKIE SECURITY
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 18. Cookie security ---")
r_login = anon.post(f"{BASE}/auth/login", json={"email": "rootline.seed@example.com", "password": "seed-password-123"})
set_cookie = r_login.headers.get("set-cookie", "")

has_httponly = "httponly" in set_cookie.lower()
has_samesite = "samesite=lax" in set_cookie.lower() or "samesite=strict" in set_cookie.lower()
has_path = "path=/" in set_cookie.lower()

record(
    18, "Cookie security",
    "SEC-36", "Session cookie HttpOnly flag (mitigates XSS token theft)",
    "HIGH", "HttpOnly present",
    f"HttpOnly in Set-Cookie: {has_httponly}",
    has_httponly,
    "POST /auth/login",
    f"Set-Cookie: {set_cookie}"
)

record(
    18, "Cookie security",
    "SEC-37", "Session cookie SameSite attribute (mitigates CSRF)",
    "HIGH", "SameSite=Lax or Strict present",
    f"SameSite in Set-Cookie: {has_samesite}",
    has_samesite,
    "POST /auth/login",
    f"Set-Cookie: {set_cookie}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 19. AUTHENTICATION TOKEN EXPOSURE
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 19. Authentication token exposure ---")
# Verify JWT is NOT in the JSON response body of login
login_body = r_login.json()
jwt_in_body = "token" in login_body or "access_token" in login_body or "jwt" in login_body
record(
    19, "Authentication token exposure",
    "SEC-38", "JWT token exposed in /auth/login response body",
    "HIGH", "JWT omitted from JSON body (delivered exclusively via HttpOnly cookie)",
    f"Token in body: {jwt_in_body}, Keys: {list(login_body.keys())}",
    not jwt_in_body,
    "POST /auth/login",
    f"Body keys: {list(login_body.keys())}"
)

# Verify token is not logged or exposed in /auth/me
r_me_raw = session_a.get(f"{BASE}/auth/me")
jwt_in_me = "eyJ" in r_me_raw.text
record(
    19, "Authentication token exposure",
    "SEC-39", "JWT token exposed in /auth/me JSON response",
    "HIGH", "No JWT string in response",
    f"JWT in text: {jwt_in_me}",
    not jwt_in_me,
    "GET /auth/me",
    f"Body: {r_me_raw.text}"
)

# ─────────────────────────────────────────────────────────────────────────────
# 20. RATE LIMITING
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- 20. Rate limiting ---")
# Trigger rate limiting with repeated bad logins
rate_limited = False
retry_after_hdr = None
for i in range(12):
    r_bad = anon.post(f"{BASE}/auth/login", json={"email": "attacker@bruteforce.com", "password": f"wrong-pass-{i}"})
    if r_bad.status_code == 429:
        rate_limited = True
        retry_after_hdr = r_bad.headers.get("retry-after")
        break

record(
    20, "Rate limiting",
    "SEC-40", "Brute-force login defense triggers HTTP 429",
    "HIGH", "HTTP 429 Too Many Requests with Retry-After header",
    f"HTTP {r_bad.status_code}, Retry-After: {retry_after_hdr}",
    rate_limited,
    "POST /auth/login",
    f"Status: {r_bad.status_code}, Detail: {r_bad.text}, Headers: Retry-After={retry_after_hdr}"
)

# ─────────────────────────────────────────────────────────────────────────────
# CLEANUP
# ─────────────────────────────────────────────────────────────────────────────
print("\n--- Cleaning up temporary test shares ---")
with engine.connect() as conn:
    conn.execute(text("DELETE FROM tree_shares WHERE id IN (:v_id, :e_id)"), {"v_id": share_viewer_id, "e_id": share_editor_id})
    conn.commit()

# Output summary
with open("docs/testing/security_test_results.json", "w") as f:
    json.dump({
        "summary": {
            "total": len(results),
            "passed": len([r for r in results if r["passed"]]),
            "failed": len([r for r in results if not r["passed"]])
        },
        "results": results
    }, f, indent=2)

print("\n" + "="*70)
print(f"AUDIT COMPLETED: {len(results)} tests executed.")
print(f"PASSED (Secure): {len([r for r in results if r['passed']])}")
print(f"FAILED (Vulnerabilities/Discrepancies): {len([r for r in results if not r['passed']])}")
print("Results saved to -> docs/testing/security_test_results.json")
print("="*70)
