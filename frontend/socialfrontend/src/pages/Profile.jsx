
import React, {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Trash,
  Lock,
  Globe,
  Pencil,
  Camera,
  Eye,
  UserRound,
  X,
  LoaderCircle,
  ImagePlus,
  ShieldCheck,
  FileText,
  Users,
  UserRoundCheck,
  Smile,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { toast } from "sonner";
import { useAuth } from "../api/authContext/UserContext";
import {
  getUserProfile,
  updateMyAvatar,
  removeMyAvatar,
  updateMyProfile,
} from "../api/auth";
import {
  deletePost,
  getPostsByUser,
  toggleSavePost,
} from "../api/posts";
import { getCommentCount } from "../api/comments";
import { getMentionUsers, getFollowStatus } from "../api/follows";
import CommentsSection from "../components/CommentsSection";
import WhatHappening from "../components/WhatHappening";
import AutoPlayVideo from "../components/AutoPlayVideo";

function Profile() {
  const { user } = useAuth();

  const [appearance, setAppearance] = useState(
    () => localStorage.getItem("postoraAppearance") || "light"
  );

  useEffect(() => {
    const handleThemeChange = (event) => {
      setAppearance(
        event.detail?.appearance ||
          localStorage.getItem("postoraAppearance") ||
          "light"
      );
    };

    window.addEventListener("postora-theme-change", handleThemeChange);

    return () =>
      window.removeEventListener("postora-theme-change", handleThemeChange);
  }, []);

  const isDarkTheme = appearance === "dark";
  const isCustomTheme = appearance === "custom";

  const pageClass = isDarkTheme
    ? "text-gray-100"
    : isCustomTheme
      ? "text-[#292344]"
      : "text-gray-900";

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

  const bodyClass = isDarkTheme
    ? "text-gray-400"
    : isCustomTheme
      ? "text-[#77708e]"
      : "text-gray-500";

  const inputClass = isDarkTheme
    ? "border-[#343843] bg-[#111318] text-gray-100 placeholder:text-gray-500 focus:border-[#2764de]"
    : isCustomTheme
      ? "border-[#ded8f4] bg-[#faf9ff] text-[#292344] placeholder:text-[#9991b4] focus:border-[#6554c0]"
      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-[#2764de]";

  const subtleHoverClass = isDarkTheme
    ? "hover:bg-[#292d36]"
    : isCustomTheme
      ? "hover:bg-[#f0edfa]"
      : "hover:bg-gray-100";

  // Profile data
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followStats, setFollowStats] = useState({
    followersCount: 0,
    followingCount: 0,
  });
  const [commentCounts, setCommentCounts] = useState({});
  const [mentionUsers, setMentionUsers] = useState([]);

  // Post interactions
  const [expandedPosts, setExpandedPosts] = useState({});
  const [showComments, setShowComments] = useState({});
  const [savingPosts, setSavingPosts] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isPending, startTransition] = useTransition();

  // Profile editing
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Avatar controls
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showEditAvatarMenu, setShowEditAvatarMenu] = useState(false);

  // Bio emoji picker
  const [showBioEmojiPicker, setShowBioEmojiPicker] = useState(false);
  const bioTextareaRef = useRef(null);
  const bioEmojiButtonRef = useRef(null);
  const avatarInputRef = useRef(null);
  const avatarMenuRef = useRef(null);
  const editAvatarMenuRef = useRef(null);

  // Post image viewer
  const [selectedImage, setSelectedImage] = useState(null);

  const [optimisticPosts, setOptimisticPosts] = useOptimistic(
    posts,
    (state, { postId, liked, likesCount }) =>
      state.map((post) =>
        post._id === postId
          ? {
              ...post,
              likes: Array(Math.max(0, likesCount)).fill(null),
              isLikedByUser: liked,
            }
          : post
      )
  );

  const isOwner =
    Boolean(user?.id || user?._id) &&
    String(user?.id || user?._id) === String(profile?._id);

  // Load profile and posts
  useEffect(() => {
    const userId = user?.id || user?._id;

    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);

      try {
        const [userProfile, userPosts] = await Promise.all([
          getUserProfile(userId),
          getPostsByUser(userId),
        ]);

        if (cancelled) return;

        setProfile(userProfile);
        setPosts(Array.isArray(userPosts) ? userPosts : []);
        setEditName(userProfile?.name || "");
        setEditBio(userProfile?.bio || "");

        const counts = {};

        await Promise.all(
          (Array.isArray(userPosts) ? userPosts : []).map(async (post) => {
            try {
              counts[post._id] = await getCommentCount(post._id);
            } catch (error) {
              console.error("Failed to load comment count:", error);
              counts[post._id] = 0;
            }
          })
        );

        if (!cancelled) setCommentCounts(counts);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load profile:", error);
          toast.error("Failed to load your profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?._id]);

  // Load follower and following counts
  useEffect(() => {
    const userId = user?.id || user?._id;
    if (!userId) return;

    let cancelled = false;

    const loadStats = async () => {
      try {
        const data = await getFollowStatus(userId);

        if (!cancelled) {
          setFollowStats({
            followersCount: data?.followersCount ?? 0,
            followingCount: data?.followingCount ?? 0,
          });
        }
      } catch (error) {
        console.error("Failed to load follow stats:", error);
      }
    };

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?._id]);

  // Load users for post mentions
  useEffect(() => {
    let active = true;

    const loadMentionUsers = async () => {
      try {
        const data = await getMentionUsers();
        if (active) setMentionUsers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load mention users:", error);
      }
    };

    loadMentionUsers();

    return () => {
      active = false;
    };
  }, []);

  // Close avatar menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        avatarMenuRef.current &&
        !avatarMenuRef.current.contains(event.target)
      ) {
        setShowAvatarMenu(false);
      }

      if (
        editAvatarMenuRef.current &&
        !editAvatarMenuRef.current.contains(event.target)
      ) {
        setShowEditAvatarMenu(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // Close the emoji picker when clicking outside it
  useEffect(() => {
    if (!showBioEmojiPicker) return;

    const handleOutsideClick = (event) => {
      const picker = document.getElementById("bio-emoji-picker");
      const button = bioEmojiButtonRef.current;

      if (
        picker &&
        !picker.contains(event.target) &&
        button &&
        !button.contains(event.target)
      ) {
        setShowBioEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showBioEmojiPicker]);

  // Save profile name and bio
  const handleSaveProfile = async (event) => {
    event.preventDefault();

    if (!isOwner || savingProfile) return;

    const name = editName.trim();
    const bio = editBio.trim();

    if (!name) {
      toast.error("Your name cannot be empty");
      return;
    }

    if (bio.length > 160) {
      toast.error("Bio cannot exceed 160 characters");
      return;
    }

    setSavingProfile(true);

    try {
      const data = await updateMyProfile({ name, bio });
      const updatedProfile = data.user || data.profile || data;

      setProfile((previous) => ({
        ...previous,
        ...updatedProfile,
        name: updatedProfile.name ?? name,
        bio: updatedProfile.bio ?? bio,
      }));

      setEditName(updatedProfile.name ?? name);
      setEditBio(updatedProfile.bio ?? bio);
      setShowEditModal(false);
      setShowBioEmojiPicker(false);

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Profile update failed:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // Upload avatar
  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !profile?._id || !isOwner) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10 MB");
      return;
    }

    setUploadingAvatar(true);
    const toastId = toast.loading("Updating avatar...");

    try {
      const updatedUser = await updateMyAvatar(profile._id, file);

      setProfile((previous) => ({
        ...previous,
        ...updatedUser,
      }));

      setShowAvatarMenu(false);
      setShowEditAvatarMenu(false);
      toast.success("Avatar updated", { id: toastId });
    } catch (error) {
      toast.error(error.message || "Failed to update avatar", {
        id: toastId,
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Remove avatar
  const handleRemoveAvatar = async () => {
    if (!profile?._id) return;

    const toastId = toast.loading("Removing avatar...");

    try {
      const updatedUser = await removeMyAvatar(profile._id);

      setProfile((previous) => ({
        ...previous,
        ...updatedUser,
      }));

      setShowRemoveModal(false);
      setShowAvatarMenu(false);
      setShowEditAvatarMenu(false);
      toast.success("Avatar removed", { id: toastId });
    } catch (error) {
      toast.error(error.message || "Failed to remove avatar", {
        id: toastId,
      });
    }
  };

  // Like post
  const handleLike = async (postId, currentLikesCount, isCurrentlyLiked) => {
    const newLiked = !isCurrentlyLiked;
    const newLikesCount = Math.max(
      0,
      currentLikesCount + (newLiked ? 1 : -1)
    );

    startTransition(async () => {
      setOptimisticPosts({
        postId,
        liked: newLiked,
        likesCount: newLikesCount,
      });

      try {
        const response = await fetch(
          `http://localhost:5000/posts/like/${postId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          }
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        setPosts((previous) =>
          previous.map((post) =>
            post._id === postId
              ? {
                  ...post,
                  likes: Array(data.likesCount).fill(null),
                  isLikedByUser: data.liked,
                }
              : post
          )
        );
      } catch (error) {
        setPosts((previous) =>
          previous.map((post) =>
            post._id === postId
              ? {
                  ...post,
                  likes: Array(currentLikesCount).fill(null),
                  isLikedByUser: isCurrentlyLiked,
                }
              : post
          )
        );

        toast.error("Failed to update like");
      }
    });
  };

  const togglePost = (postId) => {
    setExpandedPosts((previous) => ({
      ...previous,
      [postId]: !previous[postId],
    }));
  };

  const toggleComments = (postId) => {
    setShowComments((previous) => ({
      ...previous,
      [postId]: !previous[postId],
    }));
  };

  // Delete post
  const onDelete = useCallback(async (postId) => {
    try {
      await deletePost(postId);

      setPosts((previous) =>
        previous.filter((post) => post._id !== postId)
      );

      setDeleteTarget(null);
      toast.success("Post deleted successfully");
    } catch (error) {
      toast.error(error.message || "Failed to delete post");
    }
  }, []);

  // Save / unsave post
  const handleSavePost = async (postId) => {
    if (savingPosts[postId]) return;

    setSavingPosts((previous) => ({ ...previous, [postId]: true }));

    try {
      const result = await toggleSavePost(postId);

      setPosts((previous) =>
        previous.map((post) =>
          post._id === postId
            ? { ...post, isSavedByUser: result.saved }
            : post
        )
      );

      toast.success(
        result.saved
          ? "Post saved successfully"
          : "Post removed from saved posts"
      );
    } catch (error) {
      toast.error(error.message || "Failed to save post");
    } finally {
      setSavingPosts((previous) => ({ ...previous, [postId]: false }));
    }
  };

  // Remove the last full character, including combined emoji
  const removeLastBioCharacter = () => {
    setEditBio((previous) => {
      if (!previous) return previous;

      if (typeof Intl.Segmenter === "function") {
        const segmenter = new Intl.Segmenter(undefined, {
          granularity: "grapheme",
        });

        const characters = Array.from(
          segmenter.segment(previous),
          (item) => item.segment
        );

        characters.pop();
        return characters.join("");
      }

      // Fallback for browsers without Intl.Segmenter
      return Array.from(previous).slice(0, -1).join("");
    });

    bioTextareaRef.current?.focus();
  };

  // Add emoji to the end of the bio
  const handleBioEmojiClick = (emojiData) => {
    const emoji = emojiData.emoji;

    setEditBio((previous) => {
      if (previous.length + emoji.length > 160) {
        toast.error("Bio cannot exceed 160 characters");
        return previous;
      }

      return previous + emoji;
    });

    bioTextareaRef.current?.focus();
  };

  // Render clickable mentions
  const renderPostText = (content, mentions = []) => {
    if (!content) return content;

    const getId = (person) =>
      String(person?._id || person?.id || person || "");

    const validMentions = (mentions || [])
      .filter(
        (mention) =>
          mention &&
          Number.isInteger(mention.start) &&
          Number.isInteger(mention.end) &&
          mention.start >= 0 &&
          mention.end <= content.length &&
          mention.end > mention.start &&
          content.slice(mention.start, mention.end).startsWith("@")
      )
      .sort((a, b) => a.start - b.start);

    if (!validMentions.length) return content;

    const parts = [];
    let lastIndex = 0;
    let index = 0;

    validMentions.forEach((mention) => {
      if (mention.start < lastIndex) return;

      if (mention.start > lastIndex) {
        parts.push(content.slice(lastIndex, mention.start));
      }

      const userId = getId(mention.user);
      const mentionText = content.slice(mention.start, mention.end);

      const person =
        mention.user && typeof mention.user === "object"
          ? mention.user
          : mentionUsers.find((item) => getId(item) === userId);

      if (!userId) {
        parts.push(mentionText);
      } else {
        const profileUrl = `/userDetails/${userId}`;

        parts.push(
          <span
            key={`${mention.start}-${index++}`}
            className="group/mention relative inline-block"
          >
            <Link
              to={profileUrl}
              className="font-bold text-[#2764de] hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {mentionText}
            </Link>

            {person && (
              <span className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity group-hover/mention:visible group-hover/mention:opacity-100 group-focus-within/mention:visible group-focus-within/mention:opacity-100">
                <Link
                  to={profileUrl}
                  className={`flex w-56 items-center gap-3 rounded-xl border p-3 text-left shadow-xl ${panelClass}`}
                >
                  <img
                    src={person.avatar || "/avatar.png"}
                    alt={person.name || mentionText.slice(1)}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />

                  <span className="min-w-0">
                    <span
                      className={`block truncate text-sm font-semibold ${headingClass}`}
                    >
                      {person.name || mentionText.slice(1)}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#2764de]">
                      View profile
                    </span>
                  </span>
                </Link>
              </span>
            )}
          </span>
        );
      }

      lastIndex = mention.end;
    });

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts;
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <LoaderCircle className="h-9 w-9 animate-spin text-[#2764de]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`mx-auto max-w-2xl px-4 py-16 text-center ${pageClass}`}>
        <p className="text-lg font-semibold">Profile unavailable</p>
        <p className={`mt-2 text-sm ${bodyClass}`}>
          We couldn't load your profile.
        </p>
      </div>
    );
  }

  const sortedPosts = [...(optimisticPosts || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const avatarSrc = profile.avatar || "/avatar.png";
  const displayEmail = profile.email || user?.email || "";
  const hasRealAvatar =
    Boolean(profile.avatar) && profile.avatar !== "/avatar.png";

  const stats = [
    { label: "Posts", value: posts.length },
    { label: "Followers", value: followStats.followersCount },
    { label: "Following", value: followStats.followingCount },
  ];

  return (
    <div
      className={`mx-auto w-full max-w-2xl px-3 pb-24 pt-20 sm:px-4 md:pb-6 md:pt-6 ${pageClass}`}
    >
      <WhatHappening />

      {/* Profile header */}
      <div
        className={`mb-4 mt-6 rounded-xl border p-4 sm:p-6 ${
          isDarkTheme
            ? "border-[#343843] bg-[#1b1e25] text-gray-100"
            : isCustomTheme
              ? "border-[#ded8f4] bg-white text-[var(--foreground)]"
              : "border-gray-200 bg-white text-[var(--foreground)]"
        }`}
      >
        <section className="mt-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* Avatar and menu */}
            <div className="relative shrink-0 self-start" ref={avatarMenuRef}>
              <button
                type="button"
                onClick={() => {
                  if (isOwner) setShowAvatarMenu((previous) => !previous);
                  else setShowAvatarViewer(true);
                }}
                className="group relative block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2764de] focus-visible:ring-offset-4"
                aria-label={isOwner ? "Manage profile avatar" : "View avatar"}
              >
                <img
                  src={avatarSrc}
                  alt={`${profile.name}'s avatar`}
                  className={`h-24 w-24 rounded-full object-cover sm:h-28 sm:w-28 ${
                    isDarkTheme
                      ? "border-2 border-[#343843]"
                      : isCustomTheme
                        ? "border-2 border-[#ded8f4]"
                        : "border-2 border-gray-200"
                  }`}
                />

                {isOwner && (
                  <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[#2764de] text-white shadow-sm transition group-hover:bg-blue-700">
                    <Camera size={15} />
                  </span>
                )}
              </button>

              {showAvatarMenu && isOwner && (
                <div
                  className={`absolute left-0 top-[calc(100%+12px)] z-40 w-56 overflow-hidden rounded-2xl border p-1.5 shadow-xl ${panelClass}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowAvatarMenu(false);
                      setShowAvatarViewer(true);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${subtleHoverClass}`}
                  >
                    <Eye size={18} className="text-[#2764de]" />
                    <span>View avatar</span>
                  </button>

                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={() => {
                      setShowAvatarMenu(false);
                      avatarInputRef.current?.click();
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition disabled:opacity-50 ${subtleHoverClass}`}
                  >
                    <ImagePlus size={18} className="text-[#2764de]" />
                    <span>Change avatar</span>
                  </button>

                  <div
                    className={`mx-2 my-1 h-px ${
                      isDarkTheme
                        ? "bg-[#343843]"
                        : isCustomTheme
                          ? "bg-[#ded8f4]"
                          : "bg-gray-200"
                    }`}
                  />

                  <button
                    type="button"
                    disabled={!hasRealAvatar || uploadingAvatar}
                    onClick={() => {
                      setShowAvatarMenu(false);
                      setShowRemoveModal(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash size={18} />
                    <span>Remove avatar</span>
                  </button>
                </div>
              )}

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
            </div>

            {/* Name and profile information */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h1
                    className={`break-words text-2xl font-bold sm:text-3xl ${headingClass}`}
                  >
                    {profile.name}
                  </h1>

                  {profile.isPrivate ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
                      <Lock size={12} />
                      Private
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                      <Globe size={12} />
                      Public
                    </span>
                  )}
                </div>

                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditName(profile.name || "");
                      setEditBio(profile.bio || "");
                      setShowEditAvatarMenu(false);
                      setShowBioEmojiPicker(false);
                      setShowEditModal(true);
                    }}
                    className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition sm:px-4 ${panelClass} ${subtleHoverClass}`}
                  >
                    <Pencil size={15} />
                    <span>Edit profile</span>
                  </button>
                )}
              </div>

              {/* Statistics */}
              <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-3">
                {stats.map(({ label, value }) => (
                  <div key={label} className="flex items-baseline gap-1.5">
                    <span className={`text-lg font-bold ${headingClass}`}>
                      {value}
                    </span>
                    <span className={`text-sm ${bodyClass}`}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Bio */}
              {profile.bio?.trim() ? (
                <p
                  className={`mt-4 whitespace-pre-wrap break-words text-sm leading-6 ${headingClass}`}
                >
                  {profile.bio}
                </p>
              ) : isOwner ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditName(profile.name || "");
                    setEditBio(profile.bio || "");
                    setShowBioEmojiPicker(false);
                    setShowEditModal(true);
                  }}
                  className="mt-4 text-left text-sm text-[#2764de] hover:underline"
                >
                  Add a bio to tell people about yourself
                </button>
              ) : null}

              <div className={`mt-3 flex items-center gap-1.5 text-sm ${bodyClass}`}>
                <ShieldCheck size={15} />
                <span>{displayEmail || "Email unavailable"}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Posts heading */}
      <div className="mb-5 mt-8 flex items-center justify-between gap-3">
        <h2 className={`text-xl font-bold ${headingClass}`}>Posts</h2>
        <span className={`text-sm ${bodyClass}`}>
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </span>
      </div>

      {/* Posts */}
      <div>
        {sortedPosts.length === 0 ? (
          <div className={`py-12 text-center ${bodyClass}`}>
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
                isDarkTheme
                  ? "bg-[#1b1e25]"
                  : isCustomTheme
                    ? "bg-[#f0edfa]"
                    : "bg-gray-100"
              }`}
            >
              <FileText size={25} />
            </div>

            <h3 className={`mt-4 font-semibold ${headingClass}`}>
              No posts yet
            </h3>
            <p className="mt-1 text-sm">
              Your posts will appear here when you share them.
            </p>
          </div>
        ) : (
          sortedPosts.map((post) => {
            const postCardClass = isDarkTheme
              ? "bg-[#1b1e25] border-[#343843] text-gray-100"
              : isCustomTheme
                ? "border-[#ded8f4] bg-white text-[var(--foreground)]"
                : "border-gray-200 bg-white text-[var(--foreground)]";

            const postAvatarBorderClass = isDarkTheme
              ? "border-[#343843]"
              : isCustomTheme
                ? "border-[#ded8f4]"
                : "border-gray-200";

            const postSeparatorClass = isDarkTheme
              ? "border-[#343843]"
              : isCustomTheme
                ? "border-[#ded8f4]"
                : "border-gray-300";

            return (
              <article
                key={post._id}
                className={`group/post relative mb-3 flex gap-3 rounded-xl border p-3 transition-all duration-300 sm:p-5 ${postCardClass}`}
              >
                <div className="shrink-0">
                  <img
                    src={post?.user?.avatar || profile.avatar || "/avatar.png"}
                    alt={post?.user?.name || profile.name}
                    className={`h-11 w-11 rounded-full border object-cover ${postAvatarBorderClass}`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  {/* Post author and date */}
                  <div className="flex min-w-0 items-start justify-between gap-3 py-1">
                    <div className="min-w-0">
                      <p className={`truncate font-semibold ${headingClass}`}>
                        {post?.user?.name || profile.name}
                      </p>

                      <span className="mt-0.5 block text-sm text-gray-500">
                        {post?.createdAt
                          ? new Date(post.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )
                          : ""}
                      </span>
                    </div>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(post._id)}
                        aria-label="Delete post"
                        className={`shrink-0 rounded-full p-2 text-gray-500 transition hover:bg-red-500/10 hover:text-red-500 ${subtleHoverClass}`}
                      >
                        <Trash size={17} />
                      </button>
                    )}
                  </div>

                  {/* Post text and mentions */}
                  {post?.text && (
                    <div
                      className={`py-2 pr-1 text-sm leading-7 sm:pr-3 sm:text-[15px] ${headingClass}`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {expandedPosts[post._id] ? (
                          renderPostText(post.text, post.mentions || [])
                        ) : post.text.length > 180 ? (
                          <>
                            {renderPostText(
                              post.text.slice(0, 180),
                              (post.mentions || []).filter(
                                (mention) => mention.end <= 180
                              )
                            )}
                            ...
                          </>
                        ) : (
                          renderPostText(post.text, post.mentions || [])
                        )}
                      </p>

                      {post.text.length > 180 && (
                        <button
                          type="button"
                          onClick={() => togglePost(post._id)}
                          className="mt-1 font-semibold text-[#2764de] hover:underline"
                        >
                          {expandedPosts[post._id] ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Post image */}
                  {post?.image && (
                    <button
                      type="button"
                      onClick={() => setSelectedImage(post.image)}
                      aria-label="Open post image"
                      className="mt-2 block w-full overflow-hidden rounded-lg text-left"
                    >
                      <img
                        src={post.image}
                        alt="Post"
                        className="max-h-[600px] w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  )}

                  {/* Post video */}
                  {post?.video && (
                    <div className="mt-2">
                      <AutoPlayVideo
                        src={post.video}
                        className="max-h-[500px] w-full rounded-lg object-contain"
                      />
                    </div>
                  )}

                  {/* Like, comment and save controls */}
                  <div
                    className={`mt-4 flex flex-wrap items-center gap-2 border-t pt-3 text-sm sm:gap-4 ${postSeparatorClass}`}
                  >
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        handleLike(
                          post._id,
                          Array.isArray(post.likes) ? post.likes.length : 0,
                          Boolean(post.isLikedByUser)
                        )
                      }
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      <Heart
                        size={20}
                        className={
                          post.isLikedByUser
                            ? "fill-red-500 text-red-500"
                            : ""
                        }
                      />
                      <span
                        className={post.isLikedByUser ? "text-red-500" : ""}
                      >
                        {Array.isArray(post.likes) ? post.likes.length : 0}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleComments(post._id)}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-blue-50 hover:text-[#2764de] ${
                        showComments[post._id]
                          ? "bg-blue-50 text-[#2764de]"
                          : "text-gray-500"
                      }`}
                    >
                      <MessageCircle size={20} />
                      <span>{commentCounts[post._id] || 0}</span>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(savingPosts[post._id])}
                      onClick={() => handleSavePost(post._id)}
                      className={`ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 transition-colors disabled:opacity-50 ${
                        post.isSavedByUser
                          ? "bg-blue-50 text-[#2764de]"
                          : "text-gray-500 hover:bg-blue-50 hover:text-[#2764de]"
                      }`}
                      aria-label={
                        post.isSavedByUser ? "Unsave post" : "Save post"
                      }
                    >
                      <Bookmark
                        size={20}
                        fill={post.isSavedByUser ? "currentColor" : "none"}
                      />
                      <span>{post.isSavedByUser ? "Saved" : "Save"}</span>
                    </button>
                  </div>

                  <CommentsSection
                    postId={post._id}
                    showComments={showComments[post._id] || false}
                    commentsCount={commentCounts[post._id] || 0}
                    onCountChange={(count) => {
                      setCommentCounts((previous) => ({
                        ...previous,
                        [post._id]: count,
                      }));
                    }}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Edit profile modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !savingProfile
            ) {
              setShowEditModal(false);
              setShowBioEmojiPicker(false);
            }
          }}
        >
          <form
            onSubmit={handleSaveProfile}
            className={`my-auto w-full max-w-lg overflow-hidden rounded-3xl border shadow-2xl ${panelClass}`}
          >
            {/* Modal header */}
            <div
              className={`flex items-center justify-between border-b px-5 py-4 sm:px-7 ${
                isDarkTheme
                  ? "border-[#343843]"
                  : isCustomTheme
                    ? "border-[#ded8f4]"
                    : "border-gray-200"
              }`}
            >
              <h2 className={`text-lg font-bold ${headingClass}`}>
                Edit profile
              </h2>

              <button
                type="button"
                disabled={savingProfile}
                onClick={() => {
                  setShowEditAvatarMenu(false);
                  setShowEditModal(false);
                  setShowBioEmojiPicker(false);
                }}
                className={`rounded-full p-2 transition ${subtleHoverClass} ${bodyClass}`}
                aria-label="Close edit profile"
              >
                <X size={21} />
              </button>
            </div>

            <div className="space-y-6 px-5 py-6 sm:px-7">
              {/* Avatar preview and menu */}
              <div className="flex flex-col items-center">
                <div className="relative" ref={editAvatarMenuRef}>
                  <button
                    type="button"
                    onClick={() =>
                      setShowEditAvatarMenu((previous) => !previous)
                    }
                    className="group relative block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2764de]"
                    aria-label="Manage profile photo"
                  >
                    <img
                      src={avatarSrc}
                      alt="Profile avatar preview"
                      className={`h-24 w-24 rounded-full border-2 object-cover ${
                        isDarkTheme
                          ? "border-[#343843]"
                          : isCustomTheme
                            ? "border-[#ded8f4]"
                            : "border-gray-200"
                      }`}
                    />

                    <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#2764de] text-white shadow-md transition hover:bg-blue-700">
                      <Camera size={15} />
                    </span>
                  </button>

                  {showEditAvatarMenu && (
                    <div
                      className={`absolute left-1/2 top-[calc(100%+12px)] z-[130] w-56 -translate-x-1/2 overflow-hidden rounded-2xl border p-1.5 shadow-xl ${panelClass}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditAvatarMenu(false);
                          setShowAvatarViewer(true);
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${subtleHoverClass}`}
                      >
                        <Eye size={18} className="text-[#2764de]" />
                        <span>View avatar</span>
                      </button>

                      <button
                        type="button"
                        disabled={uploadingAvatar}
                        onClick={() => {
                          if (uploadingAvatar) return;
                          setShowEditAvatarMenu(false);
                          avatarInputRef.current?.click();
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition disabled:opacity-50 ${subtleHoverClass}`}
                      >
                        <ImagePlus size={18} className="text-[#2764de]" />
                        <span>Change avatar</span>
                      </button>

                      <div
                        className={`mx-2 my-1 h-px ${
                          isDarkTheme
                            ? "bg-[#343843]"
                            : isCustomTheme
                              ? "bg-[#ded8f4]"
                              : "bg-gray-200"
                        }`}
                      />

                      <button
                        type="button"
                        disabled={!hasRealAvatar || uploadingAvatar}
                        onClick={() => {
                          if (!hasRealAvatar || uploadingAvatar) return;
                          setShowEditAvatarMenu(false);
                          setShowRemoveModal(true);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash size={18} />
                        <span>Remove avatar</span>
                      </button>
                    </div>
                  )}
                </div>

                <p className={`mt-3 text-xs ${bodyClass}`}>
                  Click your photo to view or manage it.
                </p>
              </div>

              {/* Name */}
              <div>
                <label
                  htmlFor="edit-profile-name"
                  className={`mb-2 block text-sm font-semibold ${headingClass}`}
                >
                  Name
                </label>

                <input
                  id="edit-profile-name"
                  type="text"
                  autoComplete="name"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  maxLength={80}
                  required
                  placeholder="Your name"
                  className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
                />
              </div>

              {/* Bio */}
              <div>
                <label
                  htmlFor="edit-profile-bio"
                  className={`mb-2 block text-sm font-semibold ${headingClass}`}
                >
                  Bio
                </label>

                <div
                  className={`relative rounded-xl border transition focus-within:border-[#2764de] ${
                    isDarkTheme
                      ? "border-[#343843] bg-[#111318]"
                      : isCustomTheme
                        ? "border-[#ded8f4] bg-[#faf9ff]"
                        : "border-gray-300 bg-white"
                  }`}
                >
                  <textarea
                    ref={bioTextareaRef}
                    id="edit-profile-bio"
                    value={editBio}
                    onChange={(event) => setEditBio(event.target.value)}
                    maxLength={160}
                    rows={4}
                    placeholder="Write something about yourself..."
                    className={`w-full resize-none rounded-xl border-0 bg-transparent px-4 pb-9 pt-12 text-sm leading-6 outline-none focus:ring-0 ${inputClass}`}
                  />

                  {/* Emoji button */}
                  <div className="absolute right-3 top-2 z-10">
                    <button
                      type="button"
                      aria-label="Add emoji to bio"
                      ref={bioEmojiButtonRef}
                      aria-expanded={showBioEmojiPicker}
                      onClick={() =>
                        setShowBioEmojiPicker((previous) => !previous)
                      }
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                        showBioEmojiPicker
                          ? "bg-blue-50 text-[#2764de]"
                          : `${bodyClass} ${subtleHoverClass}`
                      }`}
                    >
                      <Smile size={18} />
                    </button>
                  </div>

                  {/* One emoji picker, rendered outside the modal's overflow */}
                  {showBioEmojiPicker &&
                    createPortal(
                      <div
                        id="bio-emoji-picker"
                        className="fixed z-[200]"
                        style={(() => {
                          const buttonRect =
                            bioEmojiButtonRef.current?.getBoundingClientRect();

                          const pickerWidth = 300;
                          const pickerHeight = 350;
                          const footerHeight = 49;
                          const totalHeight = pickerHeight + footerHeight;
                          const gap = 8;

                          if (!buttonRect) {
                            return {
                              left: 8,
                              top: 8,
                            };
                          }

                          const left = Math.max(
                            8,
                            Math.min(
                              buttonRect.right - pickerWidth,
                              window.innerWidth - pickerWidth - 8
                            )
                          );

                          const spaceAbove = buttonRect.top - gap;
                          const spaceBelow =
                            window.innerHeight - buttonRect.bottom - gap;

                          let top;

                          if (spaceAbove >= totalHeight) {
                            top = buttonRect.top - totalHeight - gap;
                          } else if (spaceBelow >= totalHeight) {
                            top = buttonRect.bottom + gap;
                          } else {
                            top = Math.max(
                              8,
                              Math.min(
                                buttonRect.top - totalHeight - gap,
                                window.innerHeight - totalHeight - 8
                              )
                            );
                          }

                          return { left, top };
                        })()}
                      >
                        <div className="overflow-hidden rounded-xl shadow-2xl">
                          <EmojiPicker
                            onEmojiClick={handleBioEmojiClick}
                            width={300}
                            height={350}
                            previewConfig={{ showPreview: false }}
                          />

                          {/* X button below the emoji picker */}
                          <div
                            className={`flex justify-end border-t px-3 py-2 ${
                              isDarkTheme
                                ? "border-[#343843] bg-[#111318]"
                                : isCustomTheme
                                  ? "border-[#ded8f4] bg-[#faf9ff]"
                                  : "border-gray-200 bg-white"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={removeLastBioCharacter}
                              aria-label="Remove last character from bio"
                              title="Remove last character"
                              className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                                isDarkTheme
                                  ? "text-gray-300 hover:bg-[#292d36]"
                                  : isCustomTheme
                                    ? "text-[#77708e] hover:bg-[#f0edfa]"
                                    : "text-gray-700 hover:bg-gray-100"
                              }`}
                            >
                              <X size={17} />
                            </button>
                          </div>
                        </div>
                      </div>,
                      document.body
                    )}

                  {/* Character counter */}
                  <span
                    className={`absolute bottom-3 right-3 text-xs ${bodyClass}`}
                  >
                    {editBio.length}/160
                  </span>
                </div>

                <p className={`mt-1.5 text-xs ${bodyClass}`}>
                  Share a little about yourself with your followers.
                </p>
              </div>

              {/* Locked email */}
              <div>
                <label
                  htmlFor="edit-profile-email"
                  className={`mb-2 block text-sm font-semibold ${headingClass}`}
                >
                  Email address
                </label>

                <div className="relative">
                  <input
                    id="edit-profile-email"
                    type="email"
                    value={displayEmail}
                    readOnly
                    aria-readonly="true"
                    className={`w-full cursor-not-allowed rounded-xl border px-4 py-3 pr-12 text-sm opacity-80 outline-none ${inputClass}`}
                  />

                  <Lock
                    size={17}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 ${bodyClass}`}
                  />
                </div>

                <p
                  className={`mt-2 flex items-start gap-1.5 text-xs leading-5 ${bodyClass}`}
                >
                  <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                  Your email is read-only and cannot be changed from this form.
                </p>
              </div>

              {/* Save button */}
              <button
                type="submit"
                disabled={savingProfile || !editName.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2764de] px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProfile && (
                  <LoaderCircle size={17} className="animate-spin" />
                )}
                {savingProfile ? "Saving changes..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Remove avatar confirmation */}
      {showRemoveModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${panelClass}`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <Trash size={22} />
            </div>

            <h2 className={`mt-4 text-lg font-bold ${headingClass}`}>
              Remove profile photo?
            </h2>

            <p className={`mt-2 text-sm leading-6 ${bodyClass}`}>
              Your current profile photo will be removed and replaced with the
              default avatar.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowRemoveModal(false)}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${panelClass} ${subtleHoverClass}`}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Remove photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete post confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${panelClass}`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <Trash size={22} />
            </div>

            <h2 className={`mt-4 text-lg font-bold ${headingClass}`}>
              Delete post?
            </h2>

            <p className={`mt-2 text-sm leading-6 ${bodyClass}`}>
              This post will be permanently deleted. This action cannot be
              undone.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${panelClass} ${subtleHoverClass}`}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => onDelete(deleteTarget)}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Delete post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen avatar viewer */}
      {showAvatarViewer && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo viewer"
          onClick={() => setShowAvatarViewer(false)}
        >
          <button
            type="button"
            onClick={() => setShowAvatarViewer(false)}
            aria-label="Close avatar viewer"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X size={23} />
          </button>

          <img
            src={avatarSrc}
            alt={`${profile.name}'s full-size avatar`}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[85vh] max-w-full rounded-full object-contain sm:max-h-[80vh]"
          />

          <p className="absolute bottom-6 left-4 right-4 text-center text-sm font-medium text-white/80">
            {profile.name}
          </p>
        </div>
      )}

      {/* Full-screen post image viewer */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Post image viewer"
          onClick={() => setSelectedImage(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            aria-label="Close image viewer"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X size={23} />
          </button>

          <img
            src={selectedImage}
            alt="Full-size post"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}

export default Profile;
