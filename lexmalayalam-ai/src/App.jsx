import { Routes, Route } from "react-router-dom";

// =========================================================
// Existing Pages
// =========================================================

import Splash from "./pages/Splash";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

// =========================================================
// Select Exam Page
// =========================================================

import SelectExam from "./pages/SelectExam";
import QualificationForm from "./pages/QualificationForm";

// =========================================================
// Notification Page
// =========================================================

import Notifications from "./pages/Notifications";

// =========================================================
// Existing Components
// =========================================================

// =========================================================
// Application Pages
// =========================================================

import Home from "./pages/Home";
import Upload from "./pages/Upload";
import UrlUpload from "./pages/UrlUpload";
import Documents from "./pages/Documents";
import Downloads from "./pages/Downloads";
import Transcript from "./pages/Transcript";
import StudyPlan from "./pages/StudyPlan";
import Quiz from "./pages/Quiz";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import MyProfile from "./pages/Myprofile";
import Settings from "./pages/Settings";
import Feedback from "./pages/Feedback";
import Help from "./pages/Help";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import EmailVerified from "./pages/EmailVerified";

import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import { supabase } from "./supabase";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";

// =========================================================
// ADMIN AUTHORIZATION GUARD
// =========================================================

function AdminGuard({ children }) {
  const [authState, setAuthState] = useState({ loading: true, isAdmin: false, user: null });

  useEffect(() => {
    let isMounted = true;
    async function checkAdmin() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) setAuthState({ loading: false, isAdmin: false, user: null });
          return;
        }

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        const isAdmin = profile?.role === "admin";
        if (isMounted) setAuthState({ loading: false, isAdmin, user });
      } catch (err) {
        console.error("AdminGuard check failed:", err);
        if (isMounted) setAuthState({ loading: false, isAdmin: false, user: null });
      }
    }
    checkAdmin();
    return () => { isMounted = false; };
  }, []);

  if (authState.loading) {
    return (
      <div style={{ display: "grid", minHeight: "100vh", placeItems: "center", background: "#f8fafc", fontFamily: "inherit" }}>
        <p style={{ fontWeight: 700, color: "#4f46e5" }}>Verifying administrator credentials...</p>
      </div>
    );
  }

  if (!authState.user) {
    return <Navigate to="/admin-login" replace />;
  }

  if (!authState.isAdmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "20px", background: "#f8fafc", textAlign: "center", fontFamily: "inherit" }}>
        <div style={{ padding: "30px", background: "#ffffff", borderRadius: "20px", border: "1px solid #e2e8f0", maxWidth: "420px", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
          <h2 style={{ color: "#ef4444", margin: "0 0 10px" }}>Access Denied</h2>
          <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "0 0 20px" }}>You do not have administrator access.</p>
          <a href="/admin-login" style={{ display: "inline-block", padding: "10px 20px", background: "#6366f1", color: "#ffffff", borderRadius: "12px", textDecoration: "none", fontWeight: 700, fontSize: "0.85rem" }}>
            Return to Administrator Login
          </a>
        </div>
      </div>
    );
  }

  return children;
}

// =========================================================
// APP ROUTES
// =========================================================

function App() {
  return (
    <Routes>

      {/* ===================================================
          Splash Screen
      =================================================== */}

      <Route
        path="/"
        element={<Splash />}
      />

      {/* ===================================================
          Login

          Registration flow:
          Signup → Qualification Form → Select Exam → Login
      =================================================== */}

      <Route
        path="/login"
        element={<Login />}
      />

      {/* ===================================================
          Signup / Registration

          Registration flow:
          Signup → Qualification Form → Select Exam → Login
      =================================================== */}

      <Route
        path="/signup"
        element={<Signup />}
      />

      {/* ===================================================
          Qualification Form

          Registration flow:
          Signup → Qualification Form → Select Exam → App
      =================================================== */}

      <Route
        path="/qualification-form"
        element={<QualificationForm />}
      />

      {/* ===================================================
          Select Exam

          Registration flow:
          Signup → Qualification Form → Select Exam → App
      =================================================== */}

      <Route
        path="/select-exam"
        element={<SelectExam />}
      />

      {/* ===================================================
          Home / Dashboard

          Opens directly without SplashLoader.
      =================================================== */}

      <Route
        path="/home"
        element={<Home />}
      />

      {/* ===================================================
          Notifications / Find Exam

          IMPORTANT:
          No SplashLoader here.
          Home → Notifications now opens directly without
          the splash/intermediate screen.
      =================================================== */}

      <Route
        path="/notifications"
        element={<Notifications />}
      />

      {/* Study planner */}
      <Route
        path="/study-plan"
        element={<StudyPlan />}
      />

      {/* Mock tests */}
      <Route
        path="/quiz"
        element={<Quiz />}
      />

      {/* ===================================================
          Upload PDF
      =================================================== */}

      <Route
        path="/upload"
        element={<Upload />}
      />

      {/* ===================================================
          Website URL Upload
      =================================================== */}

      <Route
        path="/url-upload"
        element={<UrlUpload />}
      />

      {/* ===================================================
          Documents
      =================================================== */}

      <Route
        path="/documents"
        element={<Documents />}
      />

      {/* ===================================================
          Downloads / PDF Library
      =================================================== */}

      <Route
        path="/downloads"
        element={<Downloads />}
      />

      {/* ===================================================
          Transcript & Summary
      =================================================== */}

      <Route
        path="/transcript-summary"
        element={<Transcript />}
      />

      {/* ===================================================
          AI Chat
      =================================================== */}

      <Route
        path="/chat"
        element={<Chat />}
      />

      {/* ===================================================
          Profile
      =================================================== */}

      <Route
        path="/profile"
        element={<Profile />}
      />

      <Route
        path="/profile/edit"
        element={<MyProfile />}
      />

      <Route
        path="/settings"
        element={<Settings />}
      />

      <Route
        path="/feedback"
        element={<Feedback />}
      />

      <Route
        path="/help"
        element={<Help />}
      />

      <Route
        path="/about"
        element={<About />}
      />

      <Route
        path="/privacy"
        element={<Privacy />}
      />

      <Route
        path="/terms"
        element={<Terms />}
      />

      {/* ===================================================
          Email Verified
      =================================================== */}

      <Route
        path="/email-verified"
        element={<EmailVerified />}
      />

      {/* ===================================================
          ADMINISTRATION SYSTEM ROUTES
      =================================================== */}

      <Route
        path="/admin-login"
        element={<AdminLogin />}
      />

      <Route
        path="/admin"
        element={
          <AdminGuard>
            <AdminPanel />
          </AdminGuard>
        }
      />

    </Routes>
  );
}

export default App;
