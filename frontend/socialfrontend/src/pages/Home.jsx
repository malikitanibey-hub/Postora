
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import WhatHappening from "../components/WhatHappening";
import PostFeeds from "../components/PostFeeds";

function Home() {
  const [activeTab, setActiveTab] = useState("foryou");
  const location = useLocation();
  const navigate = useNavigate();

  const [appearance, setAppearance] = useState(
    () => localStorage.getItem("postoraAppearance") || "light"
  );

  const isDarkTheme = appearance === "dark";
  const isCustomTheme = appearance === "custom";

  useEffect(() => {
    const handleThemeChange = (event) => {
      setAppearance(
        event.detail?.appearance ||
        localStorage.getItem("postoraAppearance") ||
        "light"
      );
    };

    window.addEventListener("postora-theme-change", handleThemeChange);

    return () => {
      window.removeEventListener("postora-theme-change", handleThemeChange);
    };
  }, []);

  const tabsContainerClass = isDarkTheme
    ? "border-[#343843] bg-[#1b1e25]"
    : isCustomTheme
      ? "border-[#ded8f4] bg-[#f5f3ff]"
      : "border-gray-200 bg-white";

  const activeTabClass = isDarkTheme
    ? "border-[#7da5ff] font-bold text-[#7da5ff]"
    : isCustomTheme
      ? "border-[#6554c0] font-bold text-[#6554c0]"
      : "border-[#2764de] font-bold text-gray-900";

  const inactiveTabClass = isDarkTheme
    ? "border-transparent font-semibold text-gray-400"
    : isCustomTheme
      ? "border-transparent font-semibold text-[#77708e]"
      : "border-transparent font-semibold text-gray-500";

  useEffect(() => {
    if (location.state?.focusComposer) {
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event("focus-post-composer"));
        navigate("/", { replace: true, state: {} });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [location.state, navigate]);

  return (
    <div className="min-w-0 w-full px-3 pt-16 pb-20 md:px-4 md:pt-6 md:pb-6">
      <div className="mx-auto w-full max-w-3xl">
        {/* For You / Following tabs */}
        <div
          className={`sticky top-16 z-30 flex items-center justify-around border-b transition-colors md:top-0 ${tabsContainerClass}`}
        >
          <button
            type="button"
            className={`flex-1 border-b-4 py-3 text-center transition-colors ${activeTab === "foryou" ? activeTabClass : inactiveTabClass
              }`}
            onClick={() => setActiveTab("foryou")}
          >
            For You
          </button>

          <button
            type="button"
            className={`flex-1 border-b-4 py-3 text-center transition-colors ${activeTab === "following" ? activeTabClass : inactiveTabClass
              }`}
            onClick={() => setActiveTab("following")}
          >
            Following
          </button>
        </div>

        {/* Create post */}
        <div className="mt-4">
          <WhatHappening />
        </div>

        {/* Posts feed */}
        <div className="mt-5">
          <PostFeeds
            activeTab={activeTab}
            notificationTarget={location.state || null}
          />
        </div>
      </div>
    </div>
  );
}

export default Home;
