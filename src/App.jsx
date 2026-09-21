import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext.jsx";
import { FamilyProvider } from "./family/FamilyContext.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";

import RootlineHome from "./RootlineHome.jsx";
import RootlineTerms from "./RootlineTerms.jsx";
import RootlinePrivacy from "./RootlinePrivacy.jsx";
import RootlineRegister from "./RootlineRegister.jsx";
import RootlineLogin from "./RootlineLogin.jsx";
import RootlineForgotPassword from "./RootlineForgotPassword.jsx";
import RootlineResetPassword from "./RootlineResetPassword.jsx";
import RootlineOAuthCallback from "./RootlineOAuthCallback.jsx";
import RootlineDashboard from "./RootlineDashboard.jsx";
import RootlineSupport from "./RootlineSupport.jsx";
import PeopleList from "./family/PeopleList.jsx";
import PersonForm from "./family/PersonForm.jsx";
import PersonDetail from "./family/PersonDetail.jsx";
import TreeView from "./family/TreeView.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FamilyProvider>
          <Routes>
            <Route path="/" element={<RootlineHome />} />
            <Route path="/terms" element={<RootlineTerms />} />
            <Route path="/privacy" element={<RootlinePrivacy />} />
            <Route path="/register" element={<RootlineRegister />} />
            <Route path="/login" element={<RootlineLogin />} />
            <Route path="/forgot-password" element={<RootlineForgotPassword />} />
            <Route path="/reset-password" element={<RootlineResetPassword />} />
            <Route path="/oauth-callback" element={<RootlineOAuthCallback />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <RootlineDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/people"
              element={
                <ProtectedRoute>
                  <PeopleList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/people/new"
              element={
                <ProtectedRoute>
                  <PersonForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/people/:id"
              element={
                <ProtectedRoute>
                  <PersonDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/people/:id/edit"
              element={
                <ProtectedRoute>
                  <PersonForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tree"
              element={
                <ProtectedRoute>
                  <TreeView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <RootlineSupport />
                </ProtectedRoute>
              }
            />
          </Routes>
        </FamilyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
