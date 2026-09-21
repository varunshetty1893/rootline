// The local Express/Vite server listens on port 3000. In production this is
// set to the public Render API URL through Vercel's VITE_API_URL variable.
const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");

/**
 * Central fetch wrapper.
 *
 * Authentication is now handled via an HttpOnly session cookie set by the
 * backend — no token is passed as an argument or stored in JavaScript.
 * `credentials: "include"` ensures the browser attaches the cookie on every
 * cross-origin request to the API.
 */
async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",          // send the HttpOnly session cookie
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail =
      res.status >= 500
        ? "The service is temporarily unavailable. Please try again."
        : data.detail;
    throw new Error(detail || "Something went wrong. Please try again.");
  }

  return data;
}

/** Append ?tree_id=... query param when a treeId is provided. */
function withTree(path, treeId) {
  return treeId ? `${path}?tree_id=${treeId}` : path;
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  updateProfile: (payload) => request("/auth/me", { method: "PATCH", body: payload }),
  forgotPassword: (email) =>
    request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, new_password) =>
    request("/auth/reset-password", { method: "POST", body: { token, new_password } }),
  askRelationshipAssistant: (payload) =>
    request("/api/ai/chat", { method: "POST", body: payload }).then((data) => ({
      answer: data?.message?.content || data?.message || "I could not generate an answer.",
      provider: data?.provider || data?.message?.provider || "Rootline guide",
    })),
  googleLoginUrl: () => `${API_URL}/auth/google/login`,

  // ── People (tree-scoped) ───────────────────────────────────────────────
  listPeople: (treeId) => request(withTree("/people", treeId)),
  createPerson: (payload, treeId) =>
    request(withTree("/people", treeId), { method: "POST", body: payload }),
  linkPeople: (payload, treeId) =>
    request(withTree("/people/link", treeId), { method: "POST", body: payload }),
  updatePerson: (id, payload) =>
    request(`/people/${id}`, { method: "PATCH", body: payload }),
  deletePerson: (id) =>
    request(`/people/${id}`, { method: "DELETE" }),

  // ── Trees ─────────────────────────────────────────────────────────────
  listTrees: () => request("/families/my-trees"),
  getTree: (treeId) => request(`/api/family/current?family_id=${encodeURIComponent(treeId)}`),
  updateTree: (treeId, payload) =>
    request(`/families/${treeId}`, { method: "PATCH", body: payload }),

  // ── Tree Shares ───────────────────────────────────────────────────────
  listShares: (treeId) => request(`/families/${treeId}/shares`),
  shareTree: (treeId, email, permission) =>
    request(`/families/${treeId}/shares`, {
      method: "POST",
      body: { email, permission },
    }),
  updateShare: (treeId, shareId, permission) =>
    request(`/families/${treeId}/shares/${shareId}`, {
      method: "PATCH",
      body: { permission },
    }),
  removeShare: (treeId, shareId) =>
    request(`/families/${treeId}/shares/${shareId}`, { method: "DELETE" }),

  // Compatibility names used by the older sharing and dashboard modals.
  getMyTrees: () => request("/families/my-trees"),
  getTreeShares: (treeId) => request(`/families/${treeId}/shares`),
  addTreeShare: (treeId, payload) =>
    request(`/families/${treeId}/shares`, { method: "POST", body: payload }),
  updateTreeShare: (treeId, shareId, payload) =>
    request(`/families/${treeId}/shares/${shareId}`, { method: "PATCH", body: payload }),
  deleteTreeShare: (treeId, shareId) =>
    request(`/families/${treeId}/shares/${shareId}`, { method: "DELETE" }),

  getFamilyHistory: (treeId, params = {}) => {
    const query = new URLSearchParams({ family_id: treeId || "", ...params });
    return request(`/api/family/history?${query}`);
  },
  getFamilyStatistics: (treeId) =>
    request(`/api/family/statistics?family_id=${encodeURIComponent(treeId || "")}`),
  explainRelationship: (payload) =>
    request("/api/ai/relationship-explain", { method: "POST", body: payload }),
  sendAIChatMessage: (payload) =>
    request("/api/ai/chat", { method: "POST", body: payload }),
  getAIChatHistory: (treeId) =>
    request(`/api/ai/chat/history?family_id=${encodeURIComponent(treeId || "")}`),
  clearAIChatHistory: (treeId) =>
    request(`/api/ai/chat/history?family_id=${encodeURIComponent(treeId || "")}`, { method: "DELETE" }),

  // ── Support ─────────────────────────────────────────────────────────────
  sendSupportQuery: (payload) =>
    request("/api/contact", { method: "POST", body: payload }),
};
