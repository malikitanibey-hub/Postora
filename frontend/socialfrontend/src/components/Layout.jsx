import React from "react";
import LeftSideBar from "./LeftSideBar";
import { useLocation } from "react-router-dom";

function Layout({ children }) {
  const { pathname } = useLocation();

  const authPaths = ["/login", "/register", "/forgot-password"];
  const hidePaths = authPaths.includes(pathname);

  if (hidePaths) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <LeftSideBar />

      <main className="flex-1 min-w-0 min-h-screen bg-background">
        {children}
      </main>
    </div>
  );
}

export default Layout;