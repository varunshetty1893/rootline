// The local Express/Vite server listens on port 3000. In production this is
// set to the public API URL if configured, or relative origin by default.
const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

/**
 * Central fetch wrapper.
 *
 * Authentication is handled via session cookies and optional Bearer token header
 * (ensuring seamless support within iframe preview environments).
 */
async function request(path, { method = "GET", body } = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("rootline_token") : null;
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",          // send the session cookie
    headers,
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
  register: async (payload) => {
    const data = await request("/auth/register", { method: "POST", body: payload });
    if (data?.token && typeof window !== "undefined") {
      localStorage.setItem("rootline_token", data.token);
    }
    return data;
  },
  login: async (payload) => {
    const data = await request("/auth/login", { method: "POST", body: payload });
    if (data?.token && typeof window !== "undefined") {
      localStorage.setItem("rootline_token", data.token);
    }
    return data;
  },
  logout: async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("rootline_token");
    }
    return request("/auth/logout", { method: "POST" });
  },
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
  createTree: (name) => request("/families", { method: "POST", body: { name } }),
  updateTree: (treeId, payload) =>
    request(`/families/${treeId}`, { method: "PATCH", body: payload }),
  deleteTree: (treeId) => request(`/families/${treeId}`, { method: "DELETE" }),
  leaveSharedTree: (treeId) => request(`/families/${treeId}/leave`, { method: "POST" }),

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

  // ── Family Invitations & Tracking ("Who sent Whom") ────────────────────
  listInvitations: (treeId) => request(`/families/${treeId}/invitations`),
  sendInvitation: (treeId, payload) =>
    request(`/families/${treeId}/invitations`, { method: "POST", body: payload }),
  cancelInvitation: (treeId, invitationId) =>
    request(`/families/${treeId}/invitations/${invitationId}`, { method: "DELETE" }),
  verifyInvitation: (token) =>
    request(`/api/invitations/verify?token=${encodeURIComponent(token)}`),
  acceptInvitation: (token) =>
    request("/api/invitations/accept", { method: "POST", body: { token } }),
  declineInvitation: (token) =>
    request("/api/invitations/decline", { method: "POST", body: { token } }),
  getMyPendingInvitations: () => request("/api/invitations/my-pending"),

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

export default api;
