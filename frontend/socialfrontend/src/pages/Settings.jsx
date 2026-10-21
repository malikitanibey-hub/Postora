import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  Eye,
  EyeOff,
  Lock,
  Moon,
  Palette,
  Shield,
  Sun,
  Volume2,
  VolumeX,
  Trash2,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  changePasswordApi,
  requestSettingsVerificationCode,
  deleteAccountApi,
  logoutApi,
} from "../api/auth";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";


function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-[#2764de]" : "bg-gray-300"
        }`}
    >
      <span
        className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"
          }`}
      />
    </button>
  );
}


function Settings() {
  const [isPrivate, setIsPrivate] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [privacySaving, setPrivacySaving] = useState(false);

  const [notifications, setNotifications] = useState(() => {
    return localStorage.getItem("postoraNotifications") !== "false";
  });

  const [notificationSound, setNotificationSound] = useState(() => {
    return localStorage.getItem("postoraNotificationSound") !== "false";
  });

  const [appearance, setAppearance] = useState(
    () => localStorage.getItem("postoraAppearance") || "light",
  );

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    verificationCode: "",
  });

  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteCodeRequested, setDeleteCodeRequested] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const loadPrivacy = async () => {
      try {
        const response = await fetch(`${API_URL}/users/me/profile`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Could not load account privacy.");
        }

        const data = await response.json();
        const loadedProfile = data.user || data;
        setProfile(loadedProfile);
        setIsPrivate(Boolean(loadedProfile.isPrivate));
      } catch (error) {
        console.error("Loading privacy failed:", error);
        toast.error("Could not load your privacy setting.");
      } finally {
        setPrivacyLoading(false);
      }
    };

    loadPrivacy();
  }, []);

  const handlePrivacyChange = async (nextValue) => {
    setPrivacySaving(true);

    try {
      const response = await fetch(`${API_URL}/users/me/privacy`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isPrivate: nextValue }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update account privacy.");
      }

      setIsPrivate(nextValue);
      toast.success(nextValue ? "Your account is now private." : "Your account is now public.");
    } catch (error) {
      console.error("Updating privacy failed:", error);
      toast.error(error.message || "Could not update account privacy.");
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleNotificationsChange = (value) => {
    setNotifications(value);
    localStorage.setItem("postoraNotifications", String(value));
    toast.success(value ? "Notifications enabled." : "Notifications disabled.");
  };

  const handleSoundChange = (value) => {
    setNotificationSound(value);
    localStorage.setItem("postoraNotificationSound", String(value));
    toast.success(value ? "Notification sound enabled." : "Notification sound muted.");
  };

  const handleAppearanceChange = (value) => {
    setAppearance(value);
    localStorage.setItem("postoraAppearance", value);

    window.dispatchEvent(
      new CustomEvent("postora-theme-change", {
        detail: { appearance: value },
      }),
    );

    const labels = {
      light: "Light",
      dark: "Dark",
      custom: "Custom",
    };

    toast.success(`${labels[value]} mode selected.`);
  };

  const needsPasswordVerification =
    profile?.hasPassword === false;

  const handleRequestPasswordCode = async () => {
    try {
      await requestSettingsVerificationCode("create-password");
      setCodeRequested(true);
      toast.success(
        "Verification code requested. Check the Postora email inbox.",
      );
    } catch (error) {
      toast.error(error.message || "Could not request verification code.");
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error("Please enter and confirm your new password.");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error("Your new password must be at least 8 characters.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    if (needsPasswordVerification) {
      if (!codeRequested || !passwordData.verificationCode.trim()) {
        toast.error("Request and enter your verification code first.");
        return;
      }
    } else if (!passwordData.currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }

    setPasswordLoading(true);

    try {
      const payload = {
        newPassword: passwordData.newPassword,
      };

      if (needsPasswordVerification) {
        payload.verificationCode = passwordData.verificationCode.trim();
      } else {
        payload.currentPassword = passwordData.currentPassword;
      }

      const result = await changePasswordApi(payload);

      toast.success(result.message || "Password updated successfully.");

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        verificationCode: "",
      });

      setCodeRequested(false);

      // Refresh profile so Settings knows a password now exists.
      const response = await fetch(`${API_URL}/users/me/profile`, {
        credentials: "include",
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile.user || updatedProfile);
      }
    } catch (error) {
      toast.error(error.message || "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRequestDeleteCode = async () => {
    try {
      await requestSettingsVerificationCode("delete-account");
      setDeleteCodeRequested(true);
      toast.success("Verification code requested. Check the Postora email inbox.");
    } catch (error) {
      toast.error(error.message || "Could not request verification code.");
    }
  };

  const handleDeleteAccount = async (event) => {
    event.preventDefault();

    if (profile?.hasPassword) {
      if (!deletePassword) {
        toast.error("Please enter your current password.");
        return;
      }
    } else if (!deleteCodeRequested || !deleteCode.trim()) {
      toast.error("Please enter your verification code.");
      return;
    }

    setDeleteLoading(true);

    try {
      const payload = profile?.hasPassword
        ? { currentPassword: deletePassword }
        : { verificationCode: deleteCode.trim() };

      const result = await deleteAccountApi(payload);

      setShowDeleteModal(false);
      toast.success(result.message || "Your Account has been deleted successfully.");
      navigate("/login", { replace: true });
      window.location.replace("/login");
    } catch (error) {
      toast.error(error.message || "Failed to delete your account.");
    } finally {
      setDeleteLoading(false);
    }
  };


  const updatePasswordField = (event) => {
    setPasswordData((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  const isDarkTheme = appearance === "dark";
  const isCustomTheme = appearance === "custom";

  const pageBackgroundClass = isDarkTheme
    ? "bg-[#111318] text-gray-100"
    : isCustomTheme
      ? "bg-[#f5f3ff] text-[#292344]"
      : "bg-gray-50 text-gray-900";

  const panelClass = isDarkTheme
    ? "border-[#343843] bg-[#1b1e25]"
    : isCustomTheme
      ? "border-[#ded8f4] bg-white"
      : "border-gray-200 bg-white";

  const headingClass = isDarkTheme
    ? "text-gray-100"
    : isCustomTheme
      ? "text-[#292344]"
      : "text-gray-900";

  const strongTextClass = isDarkTheme
    ? "text-gray-200"
    : isCustomTheme
      ? "text-[#373064]"
      : "text-gray-800";

  const bodyTextClass = isDarkTheme
    ? "text-gray-300"
    : isCustomTheme
      ? "text-[#77708e]"
      : "text-gray-500";

  const labelClass = isDarkTheme
    ? "text-gray-300"
    : isCustomTheme
      ? "text-[#373064]"
      : "text-gray-700";

  const dividerClass = isDarkTheme
    ? "border-[#343843]"
    : isCustomTheme
      ? "border-[#ded8f4]"
      : "border-gray-100";

  const iconBoxClass = isDarkTheme
    ? "bg-[#252a35] text-[#7da5ff]"
    : isCustomTheme
      ? "bg-[#ede9fe] text-[#6554c0]"
      : "bg-blue-50 text-[#2764de]";

  const inputClass = `w-full rounded-xl border px-4 py-3 pr-11 text-sm outline-none transition focus:border-[#2764de] focus:ring-2 focus:ring-blue-100 ${isDarkTheme
    ? "border-[#343843] bg-[#1b1e25] text-gray-100 placeholder:text-gray-400"
    : isCustomTheme
      ? "border-[#ded8f4] bg-white text-[#292344] placeholder:text-[#77708e]"
      : "border-gray-200 bg-white text-gray-900"
    }`;

  return (
    <main className={`min-h-screen px-4 pb-24 pt-20 md:px-8 md:pb-8 md:pt-8 ${pageBackgroundClass}`}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <Link
            to="/"
            aria-label="Back to home"
            className={`rounded-xl border p-2.5 transition ${isDarkTheme ? "border-[#343843] bg-[#1b1e25] text-gray-300 hover:bg-[#292d36] hover:text-white" : isCustomTheme ? "border-[#ded8f4] bg-white text-[#77708e] hover:bg-[#ede9fe] hover:text-[#6554c0]" : "border-gray-200 bg-white text-gray-600 hover:bg-blue-50 hover:text-[#2764de]"}`}
          >
            <ArrowLeft size={20} />
          </Link>

          <div>
            <h1 className={`text-2xl font-bold sm:text-3xl ${headingClass}`}>
              Settings
            </h1>
            <p className={`mt-1 text-sm ${bodyTextClass}`}>
              Manage your Postora account and preferences.
            </p>
          </div>
        </div>

        {/* Account privacy */}
        <section className={`mb-5 rounded-2xl border p-5 shadow-sm sm:p-6 ${panelClass}`}>
          <div className="mb-5 flex items-center gap-3">
            <div className={`rounded-xl p-3 ${iconBoxClass}`}>
              <Shield size={22} />
            </div>
            <div>
              <h2 className={`font-bold ${headingClass}`}>Account privacy</h2>
              <p className={`text-sm ${bodyTextClass}`}>
                Choose your account visibility.
              </p>
            </div>
          </div>

          <div className={`flex items-center justify-between gap-4 border-t pt-5 ${dividerClass}`}>
            <div>
              <p className={`font-semibold ${strongTextClass}`}>
                {isPrivate ? "Private account" : "Public account"}
              </p>
              <p className={`mt-1 text-sm ${bodyTextClass}`}>
                {isPrivate
                  ? "Your account is marked as private."
                  : "Your account is marked as public."}
              </p>
            </div>

            <Toggle
              label="Private account"
              checked={isPrivate}
              onChange={handlePrivacyChange}
              disabled={privacyLoading || privacySaving}
            />
          </div>

          {(privacyLoading || privacySaving) && (
            <p className="mt-3 text-xs text-gray-400">
              {privacyLoading ? "Loading privacy setting..." : "Saving changes..."}
            </p>
          )}
        </section>

        {/* Notifications */}
        <section className={`mb-5 rounded-2xl border p-5 shadow-sm sm:p-6 ${panelClass}`}>
          <div className="mb-5 flex items-center gap-3">
            <div className={`rounded-xl p-3 ${iconBoxClass}`}>
              <Bell size={22} />
            </div>
            <div>
              <h2 className={`font-bold ${headingClass}`}>Notifications</h2>
              <p className={`text-sm ${bodyTextClass}`}>
                Control your notification preferences.
              </p>
            </div>
          </div>

          <div className={`flex items-center justify-between gap-4 border-t py-4 ${dividerClass}`}>
            <div>
              <p className={`font-semibold ${strongTextClass}`}>
                Enable notifications
              </p>
              <p className={`mt-1 text-sm ${bodyTextClass}`}>
                Turn notification alerts on or off.
              </p>
            </div>
            <Toggle
              label="Enable notifications"
              checked={notifications}
              onChange={handleNotificationsChange}
            />
          </div>

          <div className={`flex items-center justify-between gap-4 border-t pt-4 ${dividerClass}`}>
            <div className="flex items-start gap-3">
              <div className="mt-1 text-gray-400">
                {notificationSound ? (
                  <Volume2 size={19} />
                ) : (
                  <VolumeX size={19} />
                )}
              </div>
              <div>
                <p className={`font-semibold ${strongTextClass}`}>
                  Notification sound
                </p>
                <p className={`mt-1 text-sm ${bodyTextClass}`}>
                  Mute or enable notification sounds independently.
                </p>
              </div>
            </div>
            <Toggle
              label="Notification sound"
              checked={notificationSound}
              onChange={handleSoundChange}
            />
          </div>
        </section>

        {/* Appearance */}
        <section className={`mb-5 rounded-2xl border p-5 shadow-sm sm:p-6 ${panelClass}`}>
          <div className="mb-5 flex items-center gap-3">
            <div className={`rounded-xl p-3 ${iconBoxClass}`}>
              <Palette size={22} />
            </div>
            <div>
              <h2 className={`font-bold ${headingClass}`}>Appearance</h2>
              <p className={`text-sm ${bodyTextClass}`}>
                Choose how Postora should look.
              </p>
            </div>
          </div>

          <div className={`grid grid-cols-1 gap-3 border-t pt-5 sm:grid-cols-3 ${dividerClass}`}>
            {[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "custom", label: "Custom", icon: Palette },
            ].map((option) => {
              const Icon = option.icon;
              const selected = appearance === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleAppearanceChange(option.value)}
                  className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${selected
                    ? isCustomTheme
                      ? "border-[#6554c0] bg-[#ede9fe] text-[#6554c0]"
                      : "border-[#2764de] bg-blue-50 text-[#2764de]"
                    : isDarkTheme
                      ? "border-[#343843] text-gray-300 hover:border-[#2764de] hover:bg-[#292d36]"
                      : isCustomTheme
                        ? "border-[#ded8f4] text-[#373064] hover:border-[#b8aceb] hover:bg-[#f0edfa]"
                        : "border-gray-200 text-gray-700 hover:border-blue-200 hover:bg-gray-50"
                    }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={20} />
                    <span className="font-semibold">{option.label}</span>
                  </span>
                  {selected && <Check size={18} />}
                </button>
              );
            })}
          </div>

        </section>

        {/* Change password */}
        <section className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${panelClass}`}>
          <div className="mb-5 flex items-center gap-3">
            <div className={`rounded-xl p-3 ${iconBoxClass}`}>
              <Lock size={22} />
            </div>
            <div>
              <h2 className={`font-bold ${headingClass}`}>Change password</h2>
              <p className={`text-sm ${bodyTextClass}`}>
                Update your account password.
              </p>
            </div>
          </div>

          <form
            onSubmit={handlePasswordSubmit}
            className={`space-y-4 border-t pt-5 ${dividerClass}`}
          >
            {needsPasswordVerification ? (
              <div className="space-y-3">
                <p className={`text-sm ${isDarkTheme ? "text-gray-300" : isCustomTheme ? "text-[#77708e]" : "text-gray-600"}`}>
                  Your account does not have a Postora password yet. Verify your email
                  before creating one.
                </p>

                <button
                  type="button"
                  onClick={handleRequestPasswordCode}
                  disabled={codeRequested || passwordLoading}
                  className="rounded-xl border border-[#2764de] px-4 py-2.5 text-sm font-semibold text-[#2764de] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {codeRequested ? "Verification code requested" : "Request verification code"}
                </button>

                {codeRequested && (
                  <div>
                    <label
                      htmlFor="verificationCode"
                      className={`mb-2 block text-sm font-semibold ${labelClass}`}
                    >
                      Verification code
                    </label>
                    <input
                      id="verificationCode"
                      name="verificationCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={passwordData.verificationCode}
                      onChange={updatePasswordField}
                      className={inputClass}
                      placeholder="Enter your 6-digit code"
                      maxLength={6}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label
                  htmlFor="currentPassword"
                  className={`mb-2 block text-sm font-semibold ${labelClass}`}
                >
                  Current password
                </label>

                <div className="relative">
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={updatePasswordField}
                    autoComplete="current-password"
                    className={inputClass}
                    placeholder="Current password"
                  />
                  <button
                    type="button"
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowCurrentPassword((value) => !value)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDarkTheme ? "text-gray-400 hover:text-gray-100" : isCustomTheme ? "text-[#77708e] hover:text-[#292344]" : "text-gray-400 hover:text-gray-700"}`}
                  >
                    {showCurrentPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>
            )}

            {[
              {
                name: "newPassword",
                label: "New password",
                show: showNewPassword,
                setShow: setShowNewPassword,
                autoComplete: "new-password",
              },
              {
                name: "confirmPassword",
                label: "Confirm new password",
                show: showConfirmPassword,
                setShow: setShowConfirmPassword,
                autoComplete: "new-password",
              },
            ].map((field) => (
              <div key={field.name}>
                <label
                  htmlFor={field.name}
                  className={`mb-2 block text-sm font-semibold ${labelClass}`}
                >
                  {field.label}
                </label>

                <div className="relative">
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.show ? "text" : "password"}
                    value={passwordData[field.name]}
                    onChange={updatePasswordField}
                    autoComplete={field.autoComplete}
                    className={inputClass}
                    placeholder={field.label}
                  />

                  <button
                    type="button"
                    aria-label={field.show ? "Hide password" : "Show password"}
                    onClick={() => field.setShow((value) => !value)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDarkTheme ? "text-gray-400 hover:text-gray-100" : isCustomTheme ? "text-[#77708e] hover:text-[#292344]" : "text-gray-400 hover:text-gray-700"}`}
                  >
                    {field.show ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>
            ))}

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full rounded-xl bg-[#2764de] px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {passwordLoading ? "Updating..." : "Update password"}
            </button>
          </form>
        </section>

        {/* Delete account */}
        <section className={`mt-5 rounded-2xl border border-red-200 p-5 shadow-sm sm:p-6 ${isDarkTheme ? "bg-[#1b1e25]" : isCustomTheme ? "bg-white" : "bg-white"}`}>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-50 p-3 text-red-600">
              <Trash2 size={22} />
            </div>

            <div className="flex-1">
              <h2 className={`font-bold ${headingClass}`}>Delete account</h2>
              <p className={`mt-1 text-sm ${bodyTextClass}`}>
                Permanently delete your account and associated Postora content.
                This action cannot be undone.
              </p>

              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="mt-4 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700"
              >
                Delete account
              </button>
            </div>
          </div>
        </section>

        {/* Delete account confirmation modal */}
        {showDeleteModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget && !deleteLoading) {
                setShowDeleteModal(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              className={`w-full max-w-md rounded-2xl p-6 shadow-xl ${panelClass}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-red-50 p-3 text-red-600">
                  <Trash2 size={22} />
                </div>

                <button
                  type="button"
                  aria-label="Close dialog"
                  disabled={deleteLoading}
                  onClick={() => setShowDeleteModal(false)}
                  className={`rounded-lg p-2 ${isDarkTheme ? "text-gray-400 hover:bg-[#292d36] hover:text-gray-100" : isCustomTheme ? "text-[#77708e] hover:bg-[#f0edfa] hover:text-[#292344]" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
                >
                  <X size={20} />
                </button>
              </div>

              <h2
                id="delete-account-title"
                className={`text-xl font-bold ${headingClass}`}
              >
                Delete your account?
              </h2>

              <p className={`mt-2 text-sm leading-6 ${isDarkTheme ? "text-gray-300" : isCustomTheme ? "text-[#77708e]" : "text-gray-600"}`}>
                Your account and associated content will be permanently deleted.
                You won't be able to undo this action.
              </p>

              <form onSubmit={handleDeleteAccount} className="mt-5 space-y-4">
                {profile?.hasPassword ? (
                  <div>
                    <label
                      htmlFor="deletePassword"
                      className={`mb-2 block text-sm font-semibold ${labelClass}`}
                    >
                      Current password
                    </label>

                    <input
                      id="deletePassword"
                      type="password"
                      autoComplete="current-password"
                      value={deletePassword}
                      onChange={(event) => setDeletePassword(event.target.value)}
                      className={inputClass}
                      placeholder="Enter your current password"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className={`text-sm ${isDarkTheme ? "text-gray-300" : isCustomTheme ? "text-[#77708e]" : "text-gray-600"}`}>
                      Verify your account with a code before deleting it.
                    </p>

                    <button
                      type="button"
                      onClick={handleRequestDeleteCode}
                      disabled={deleteCodeRequested || deleteLoading}
                      className="rounded-xl border border-[#2764de] px-4 py-2.5 text-sm font-semibold text-[#2764de] hover:bg-blue-50 disabled:opacity-50"
                    >
                      {deleteCodeRequested
                        ? "Verification code requested"
                        : "Request verification code"}
                    </button>

                    {deleteCodeRequested && (
                      <div>
                        <label
                          htmlFor="deleteCode"
                          className={`mb-2 block text-sm font-semibold ${labelClass}`}
                        >
                          Verification code
                        </label>

                        <input
                          id="deleteCode"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={deleteCode}
                          onChange={(event) => setDeleteCode(event.target.value)}
                          className={inputClass}
                          placeholder="Enter your 6-digit code"
                          required
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={deleteLoading}
                    onClick={() => setShowDeleteModal(false)}
                    className={`rounded-xl border px-4 py-3 font-semibold disabled:opacity-50 ${isDarkTheme ? "border-[#343843] text-gray-200 hover:bg-[#292d36]" : isCustomTheme ? "border-[#ded8f4] text-[#373064] hover:bg-[#f0edfa]" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      deleteLoading ||
                      (profile?.hasPassword === undefined && !profile)
                    }
                    className="rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleteLoading ? "Deleting..." : "Permanently delete"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

export default Settings;
