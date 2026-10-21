import "./App.css";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./api/authContext/UserContext";
import RegisterForm from "./pages/RegisterForm";
import LoginForm from "./pages/LoginForm";
import Profile from "./pages/Profile";
import { toast, Toaster } from "sonner";
import UserDetails from "./pages/UserDetails";
import Notifications from "./pages/Notifications";
import ForgotPassword from "./pages/ForgotPassword";
import { useEffect, useState } from "react";
import Search from "./pages/Search";
import SavedPosts from "./pages/SavedPosts";
import Settings from "./pages/Settings";

function App() {
  const { user, loading } = useAuth();

  const [appearance, setAppearance] = useState(
    () => localStorage.getItem("postoraAppearance") || "light",
  );

  useEffect(() => {
    const handleThemeChange = (event) => {
      setAppearance(event.detail.appearance);
    };

    window.addEventListener("postora-theme-change", handleThemeChange);

    return () => {
      window.removeEventListener("postora-theme-change", handleThemeChange);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("dark", "custom");
    root.classList.add(appearance);

    root.style.colorScheme = appearance === "dark" ? "dark" : "light";
  }, [appearance]);

  useEffect(() => {
    if (loading || !user) return;

    const welcomeType = sessionStorage.getItem("postoraWelcomeType");

    if (!welcomeType) return;

    // Remove it first so the welcome appears only once.
    sessionStorage.removeItem("postoraWelcomeType");

    const name = user.name?.trim();

    if (welcomeType === "login") {
      toast.success(
        name
          ? `Welcome back, ${name}! 👋 Great to see you again.`
          : "Welcome back! 👋 Great to see you again.",
        {
          position: "top-center",
          duration: 4000,
        },
      );
    }

    if (welcomeType === "register") {
      toast.success(
        name
          ? `Welcome to Postora, ${name}! 🎉 Your journey starts here.`
          : "Welcome to Postora! 🎉 Your journey starts here.",
        {
          position: "top-center",
          duration: 5000,
        },
      );
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <img src="/logo-1.png" alt="Postora" className="w-40 mx-auto mb-6" />

          <div className="h-8 w-8 mx-auto rounded-full border-4 border-gray-200 border-t-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster />

      <BrowserRouter>
        <Layout>
          <Routes>
            {/* Protected Home */}
            <Route
              path="/"
              element={user ? <Home /> : <Navigate to="/login" replace />}
            />

            {/* Register */}
            <Route
              path="/register"
              element={user ? <Navigate to="/" replace /> : <RegisterForm />}
            />

            {/* Login */}
            <Route
              path="/login"
              element={user ? <Navigate to="/" replace /> : <LoginForm />}
            />

            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Protected Search */}
            <Route
              path="/search"
              element={user ? <Search /> : <Navigate to="/login" replace />}
            />

            <Route path="/saved-posts" element={<SavedPosts />} />

            {/* Protected Settings */}
            <Route
              path="/settings"
              element={user ? <Settings /> : <Navigate to="/login" replace />}
            />

            {/* Login */}
            <Route path="/userDetails/:id" element={<UserDetails />} />

            {/* Protected Profile */}
            <Route
              path="/profile/:id"
              element={user ? <Profile /> : <Navigate to="/login" replace />}
            />

            <Route
              path="/notifications"
              element={
                user ? <Notifications /> : <Navigate to="/login" replace />
              }
            />

            {/* Anything else */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </>
  );
}

export default App;
