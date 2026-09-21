"""
Rootline API & Web Performance Benchmark Suite
Measures actual timings (ms), payload sizes (bytes), and database overhead:
- Initial page load (Frontend http://localhost:5173/)
- Login response (POST /auth/login)
- Current user profile (GET /auth/me)
- Tree list response (GET /trees)
- Single tree metadata response (GET /trees/{id})
- People list response (GET /people?tree_id=...)
- Tree sharing list (GET /trees/{id}/shares)
- Tree activities list (GET /trees/{id}/activities)
- Backend health check (GET /health)
"""

import time
import json
import statistics
import requests

API_BASE = "http://127.0.0.1:8000"
FE_BASE  = "http://localhost:5173"

ITERATIONS = 5
results = {}

def benchmark(name, func):
    times = []
    sizes = []
    statuses = []
    for _ in range(ITERATIONS):
        time.sleep(0.05)
        t0 = time.perf_counter()
        resp = func()
        t1 = time.perf_counter()
        elapsed_ms = (t1 - t0) * 1000
        times.append(elapsed_ms)
        sizes.append(len(resp.content) if hasattr(resp, "content") else 0)
        statuses.append(resp.status_code if hasattr(resp, "status_code") else 200)

    mean_ms = statistics.mean(times)
    median_ms = statistics.median(times)
    min_ms = min(times)
    max_ms = max(times)
    avg_size = statistics.mean(sizes)

    res = {
        "endpoint": name,
        "iterations": ITERATIONS,
        "mean_ms": round(mean_ms, 2),
        "median_ms": round(median_ms, 2),
        "min_ms": round(min_ms, 2),
        "max_ms": round(max_ms, 2),
        "payload_bytes": int(avg_size),
        "status_code": statuses[0]
    }
    results[name] = res
    print(f"[{name}] {mean_ms:.1f}ms (min: {min_ms:.1f}ms, max: {max_ms:.1f}ms) | Size: {avg_size:.0f} bytes | Status: {statuses[0]}")
    return res

print("="*70)
print(f"RUNNING ROOTLINE API & WEB PERFORMANCE BENCHMARK ({ITERATIONS} RUNS EACH)")
print("="*70)

# 1. Initial frontend page load (Vite dev server)
benchmark("Frontend Initial Page Load (GET /)", lambda: requests.get(FE_BASE))

# 2. Health check baseline
benchmark("Backend Health Check (GET /health)", lambda: requests.get(f"{API_BASE}/health"))

# 3. Create session and authenticate
s = requests.Session()
login_res = s.post(f"{API_BASE}/auth/login", json={"email": "rootline.seed@example.com", "password": "seed-password-123"})
print(f"Authenticated session: status {login_res.status_code}")

# Login response benchmark (using a fresh session each time)
def measure_login():
    fresh = requests.Session()
    return fresh.post(f"{API_BASE}/auth/login", json={"email": "rootline.seed@example.com", "password": "seed-password-123"})

benchmark("Login Response (POST /auth/login)", measure_login)

# 4. Profile response (GET /auth/me)
benchmark("Current User Profile (GET /auth/me)", lambda: s.get(f"{API_BASE}/auth/me"))

# 5. Tree list response (GET /trees)
benchmark("Tree List Response (GET /trees)", lambda: s.get(f"{API_BASE}/trees"))

trees_resp = s.get(f"{API_BASE}/trees").json()
tree_id = trees_resp["owned_trees"][0]["id"]

# 6. Single Tree Metadata response (GET /trees/{id})
benchmark("Tree Metadata (GET /trees/{id})", lambda: s.get(f"{API_BASE}/trees/{tree_id}"))

# 7. People List response (GET /people?tree_id={id}) - 117 Seed Records
benchmark("People List Response (GET /people - 117 records)", lambda: s.get(f"{API_BASE}/people", params={"tree_id": tree_id}))

# 8. Tree Shares response (GET /trees/{id}/shares)
benchmark("Tree Shares (GET /trees/{id}/shares)", lambda: s.get(f"{API_BASE}/trees/{tree_id}/shares"))

# 9. Tree Activities response (GET /trees/{id}/activities)
benchmark("Tree Activities (GET /trees/{id}/activities)", lambda: s.get(f"{API_BASE}/trees/{tree_id}/activities"))

# Save results
with open("docs/testing/api_perf_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("\nResults saved to -> docs/testing/api_perf_results.json")
