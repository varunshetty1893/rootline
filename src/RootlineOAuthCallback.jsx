import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api.js";
import { useAuth } from "./AuthContext.jsx";

/**
 * Landing page after Google's OAuth redirect.
 *
 * The backend sets an HttpOnly session cookie before redirecting here — no
 * token ever appears in the URL.  We simply call /auth/me (the browser sends
 * the cookie automatically) to hydrate the user profile, then forward to the
 * dashboard.
 */
export default function RootlineOAuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    api
      .me()
      .then((user) => {
        login(user);
        navigate("/dashboard");
      })
      .catch(() => navigate("/login"));
  }, [navigate, login]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F5F0]">
      <p className="text-sm text-[#6B7280]">Signing you in…</p>
    </div>
  );
}
