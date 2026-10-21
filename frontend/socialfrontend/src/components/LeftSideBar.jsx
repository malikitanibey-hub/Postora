import React, { useEffect, useState } from "react";
import {
  Bell,
  Bookmark,
  Home,
  LogOut,
  Mail,
  Search,
  User,
  Menu,
  X,
  Settings,
  PlusSquare,
} from "lucide-react";
import { useAuth } from "../api/authContext/UserContext";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useSocket } from "../api/authContext/SocketContext";

function LeftSideBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useSocket();

  const [menuOpen, setMenuOpen] = useState(false);
  const [appearance, setAppearance] = useState(
    () => localStorage.getItem("postoraAppearance") || "light",
  );

  useEffect(() => {
    const handleThemeChange = (event) => {
      setAppearance(event.detail?.appearance || localStorage.getItem("postoraAppearance") || "light");
    };

    window.addEventListener("postora-theme-change", handleThemeChange);
    return () => window.removeEventListener("postora-theme-change", handleThemeChange);
  }, []);

  const isDarkTheme = appearance === "dark";
  const isCustomTheme = appearance === "custom";
  const logoSrc = isDarkTheme ? "/logo.png" : "/logo-1.png";

  const sidebarSurfaceClass = isDarkTheme
    ? "bg-[#111318] border-[#343843] text-gray-100"
    : isCustomTheme
      ? "bg-[#f5f3ff] border-[#ded8f4] text-[#292344]"
      : "bg-[#f8fafc] border-gray-200 text-gray-900";

  const navTextClass = isDarkTheme
    ? "text-gray-200"
    : isCustomTheme
      ? "text-[#373064]"
      : "text-gray-800";

  const inactiveHoverClass = isDarkTheme
    ? "hover:bg-[#292d36] hover:text-white"
    : isCustomTheme
      ? "hover:bg-[#e2dcf7] hover:text-[#6554c0]"
      : "hover:bg-blue-50 hover:text-[#2764de]";

  const activeNavClass = isDarkTheme
    ? "bg-[#292d36] font-bold text-[#7da5ff]"
    : isCustomTheme
      ? "bg-[#e2dcf7] font-bold text-[#6554c0]"
      : "bg-blue-50 font-bold text-[#2764de]";

  const profileHoverClass = isDarkTheme
    ? "hover:bg-[#292d36]"
    : isCustomTheme
      ? "hover:bg-[#e2dcf7]"
      : "hover:bg-gray-50";

  const mutedTextClass = isDarkTheme
    ? "text-gray-400"
    : isCustomTheme
      ? "text-[#77708e]"
      : "text-gray-500";

  const profilePath = `/profile/${user?._id || user?.id}`;

  const menu = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Search, label: "Search", path: "/search" },
    { icon: Mail, label: "Messages", path: "/messages" },
    { icon: Bookmark, label: "Saved Posts", path: "/saved-posts" },
    {
      icon: Bell,
      label: "Notifications",
      path: "/notifications",
      badge: true,
    },
    { icon: User, label: "Profile", path: profilePath },
  ];

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
      setMenuOpen(false);
      toast.success("Logged out successfully!");
      navigate("/login");
    } catch (error) {
      toast.error("Failed to log out");
      console.error(error);
    }
  };

  const handlePost = () => {
    setMenuOpen(false);

    const focusComposer = () => {
      window.dispatchEvent(new Event("focus-post-composer"));
    };

    if (location.pathname === "/") {
      focusComposer();
    } else {
      navigate("/", { state: { focusComposer: true } });
    }
  };

  const closeMenu = () => setMenuOpen(false);

  const renderMenuItem = (item, mobile = false) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <Link
        key={item.label}
        to={item.path}
        onClick={mobile ? closeMenu : undefined}
        aria-label={item.label}
        className={`relative flex items-center gap-3 rounded-xl
          font-semibold transition-colors 
          ${inactiveHoverClass}
          ${mobile
            ? "flex-col justify-center gap-1 px-1 py-2 text-xs"
            : "p-3 text-lg"
          }
          ${active ? (isCustomTheme ? "text-[#6554c0]" : "text-[#2764de]") : navTextClass}
        `}
      >
        <span className="relative flex items-center justify-center">
          <Icon size={mobile ? 23 : 24} strokeWidth={active ? 2.5 : 2} />

          {item.badge && unreadCount > 0 && (
            <span
              className={`absolute flex items-center justify-center
                rounded-full bg-red-500 font-bold text-white
                ${mobile
                  ? "-right-2 -top-2 min-w-4 h-4 px-1 text-[9px]"
                  : "-right-2 -top-2 min-w-5 h-5 px-1 text-[11px]"
                }`}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </span>

        <span>
          {mobile && item.label === "Notifications" ? "Alerts" : item.label}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r px-4 py-6 md:flex ${sidebarSurfaceClass}`}>
        {/* Logo */}
        <Link
          to="/"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "/";
          }}
          className="mb-4 flex h-32 shrink-0 items-center justify-center px-2"
        >
          <img
            src={logoSrc}
            alt="Postora logo"
            className="h-32 w-full object-contain"
          />
        </Link>

        {/* Navigation */}
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {" "}
          {menu
            .filter((item) => item.label !== "Profile")
            .map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link
                  key={item.label}
                  to={item.path}
                  aria-label={item.label}

                  className={`group relative flex items-center gap-4 rounded-xl px-4 py-3 font-bold transition-colors ${active
                      ? activeNavClass
                      : `${navTextClass} ${inactiveHoverClass}`
                    }`}

                >
                  {active && (
                    <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-[#2764de]" />
                  )}

                  <span className="relative flex items-center justify-center">
                    <Icon
                      size={23}
                      strokeWidth={active ? 2.5 : 1.8}
                      className="transition-transform duration-200 group-hover:scale-105"
                    />

                    {item.badge && unreadCount > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </span>

                  <span className="text-[15px]">{item.label}</span>
                </Link>
              );
            })}

          {/* Settings */}
          <Link
            to="/settings"

            className={`group relative flex items-center gap-4 rounded-xl px-4 py-3 font-bold transition-colors ${isActive("/settings")
                ? activeNavClass
                : `${navTextClass} ${inactiveHoverClass}`
              }`}

          >
            {isActive("/settings") && (

              <span
                className={`absolute bottom-2 left-0 top-2 w-1 rounded-r-full ${isDarkTheme
                    ? "bg-[#7da5ff]"
                    : isCustomTheme
                      ? "bg-[#6554c0]"
                      : "bg-[#2764de]"
                  }`}
              />
            )}

            <Settings
              size={23}
              strokeWidth={isActive("/settings") ? 2.5 : 1.8}
              className="transition-transform duration-200 group-hover:rotate-12"
            />
            <span className="text-[15px]">Settings</span>
          </Link>

          {/* Logout */}
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className={`group flex items-center gap-4 rounded-xl px-4 py-3 text-left font-bold transition-colors ${navTextClass} ${inactiveHoverClass}`}
            >
              <LogOut size={23} strokeWidth={1.8} />
              <span className="text-[15px]">Logout</span>
            </button>
          )}
        </nav>

        {/* Bottom section */}
        <div className={`mt-4 shrink-0 border-t pt-4 ${isDarkTheme ? "border-[#343843]" : isCustomTheme ? "border-[#ded8f4]" : "border-gray-100"}`}>
          {user && (
            <Link
              to={profilePath}
              className={`mb-4 flex min-w-0 items-center gap-3 rounded-xl p-3 transition-colors ${profileHoverClass}`}
            >
              <img
                src={user?.avatar || "/avatar.png"}
                alt={user?.name || "User"}
                className={`h-10 w-10 shrink-0 rounded-full border object-cover ${isDarkTheme ? "border-[#343843]" : isCustomTheme ? "border-[#ded8f4]" : "border-gray-200"}`}
              />

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-bold ${isDarkTheme ? "text-gray-100" : isCustomTheme ? "text-[#292344]" : "text-gray-900"}`}>
                  {user?.name || "Your profile"}
                </p>
                <p className={`text-xs ${mutedTextClass}`}>View your profile</p>
              </div>
            </Link>
          )}

          <button
            type="button"
            onClick={handlePost}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2764de] px-4 py-3.5 font-bold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md active:scale-[0.98]"
          >
            <PlusSquare size={20} />
            <span>Create post</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header
        className={`fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b px-4 md:hidden ${sidebarSurfaceClass} shadow-sm`}
      >
        <Link to="/" onClick={closeMenu}>
          <img
            src={logoSrc}
            alt="Postora logo"
            className="h-24 w-auto object-contain"
          />
        </Link>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className={`rounded-lg p-2 ${navTextClass} ${isDarkTheme ? "hover:bg-[#292d36]" : isCustomTheme ? "hover:bg-[#e2dcf7]" : "hover:bg-gray-100"}`}
        >
          {menuOpen ? <X size={25} /> : <Menu size={25} />}
        </button>
      </header>

      {/* Mobile hamburger menu */}
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu overlay"
            onClick={closeMenu}
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
          />

          <aside className={`fixed right-0 top-16 z-50 max-h-[calc(100dvh-4rem)] w-72 max-w-[85vw] overflow-y-auto rounded-bl-2xl border-b border-l p-4 shadow-xl md:hidden ${sidebarSurfaceClass}`}>
            <nav className="flex flex-col gap-2">
              {/* Bookmarks */}
              <Link
                to="/saved-posts"
                onClick={closeMenu}
                className={`flex items-center gap-3 rounded-xl p-3 font-semibold transition-colors ${inactiveHoverClass} ${isActive("/saved-posts") ? (isCustomTheme ? "text-[#6554c0]" : "text-[#2764de]") : navTextClass
                  }`}
              >
                <Bookmark size={22} />
                <span>Saved Posts</span>
              </Link>

              {/* Create post */}
              <button
                type="button"
                onClick={handlePost}
                className={`flex items-center gap-3 rounded-xl p-3 text-left font-semibold transition-colors ${navTextClass} ${inactiveHoverClass}`}
              >
                <PlusSquare size={22} />
                <span>Create post</span>
              </button>

              {/* Settings */}
              {/* Settings */}
              <Link
                to="/settings"
                onClick={closeMenu}
                className={`flex items-center gap-3 rounded-xl p-3 font-semibold transition-colors ${isActive("/settings")
                    ? activeNavClass
                    : `${navTextClass} ${inactiveHoverClass}`
                  }`}
              >
                <Settings size={22} />
                <span>Settings</span>
              </Link>

              {/* Logout */}
              {user && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`flex items-center gap-3 rounded-xl p-3 text-left font-semibold transition-colors ${navTextClass} ${inactiveHoverClass}`}
                >
                  <LogOut size={22} />
                  <span>Logout</span>
                </button>
              )}
            </nav>
          </aside>
        </>
      )}

      {/* Mobile bottom navigation */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t px-1 pb-[env(safe-area-inset-bottom)] md:hidden ${sidebarSurfaceClass} shadow-lg`}
      >        {[menu[0], menu[1], menu[2], menu[4], menu[5]].map((item) =>
        renderMenuItem(item, true),
      )}
      </nav>
    </>
  );
}

export default LeftSideBar;
