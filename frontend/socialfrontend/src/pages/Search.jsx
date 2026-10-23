import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search as SearchIcon,
  Users,
  FileText,
  LoaderCircle,
  X,
  CalendarDays,
  Heart,
  MessageCircle,
  Bookmark,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { searchUsers } from "../api/auth";
import { searchPosts, toggleSavePost } from "../api/posts";
import CommentsSection from "../components/CommentsSection";
import { getCommentCount } from "../api/comments";
import { toast } from "sonner";
import ImageViewer from "../components/ImageViewer";
import { useAuth } from "../api/authContext/UserContext";
import {
  getFollowStatus,
  followUser,
  unfollowUser,
  getMentionUsers,
} from "../api/follows";

function Search() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("people");
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showComments, setShowComments] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [likingPosts, setLikingPosts] = useState({});
  const [savingPosts, setSavingPosts] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [followStatuses, setFollowStatuses] = useState({});
  const [followLoading, setFollowLoading] = useState({});
  const [mentionUsers, setMentionUsers] = useState([]);

  const [appearance, setAppearance] = useState(
    () => localStorage.getItem("postoraAppearance") || "light",
  );

  const { user } = useAuth();

  const isDarkTheme = appearance === "dark";
  const isCustomTheme = appearance === "custom";

  useEffect(() => {
    const handleThemeChange = (event) => {
      setAppearance(
        event.detail?.appearance ||
        localStorage.getItem("postoraAppearance") ||
        "light",
      );
    };

    window.addEventListener("postora-theme-change", handleThemeChange);

    return () => {
      window.removeEventListener("postora-theme-change", handleThemeChange);
    };
  }, []);

  const pageBackgroundClass = isDarkTheme
    ? "bg-[#111318]"
    : isCustomTheme
      ? "bg-[#f5f3ff]"
      : "bg-gray-50";

  const headerClass = isDarkTheme
    ? "border-[#343843] bg-[#1b1e25]"
    : isCustomTheme
      ? "border-[#ded8f4] bg-white"
      : "border-gray-200 bg-white";

  const headerTitleClass = isDarkTheme
    ? "text-gray-100"
    : isCustomTheme
      ? "text-[#292344]"
      : "text-gray-900";

  const headerSubtitleClass = isDarkTheme
    ? "text-gray-400"
    : isCustomTheme
      ? "text-[#77708e]"
      : "text-gray-500";

  const postCardClass = isDarkTheme
    ? "bg-[#1b1e25] border-[#343843] text-gray-100"
    : isCustomTheme
      ? "bg-white border-[#ded8f4] text-[#292344]"
      : "bg-white border-gray-200 text-gray-900";

  const avatarBorderClass = isDarkTheme
    ? "border-[#343843]"
    : isCustomTheme
      ? "border-[#ded8f4]"
      : "border-gray-200";

  const separatorClass = isDarkTheme
    ? "border-[#343843]"
    : isCustomTheme
      ? "border-[#ded8f4]"
      : "border-gray-300";

  const nameTextClass = isDarkTheme
    ? "text-gray-100 hover:text-[#7da5ff]"
    : isCustomTheme
      ? "text-[#292344] hover:text-[#6554c0]"
      : "text-gray-900 hover:text-[#2764de]";

  const dateTextClass = isDarkTheme
    ? "text-gray-400"
    : isCustomTheme
      ? "text-[#77708e]"
      : "text-gray-500";

  const postTextClass = isDarkTheme
    ? "text-gray-200"
    : isCustomTheme
      ? "text-[#292344]"
      : "text-gray-800";

  const actionTextClass = isDarkTheme
    ? "text-gray-400"
    : isCustomTheme
      ? "text-[#77708e]"
      : "text-gray-500";

  const inputClass = isDarkTheme
    ? "border-[#343843] bg-[#111318] text-gray-100 placeholder:text-gray-500 focus-within:bg-[#111318] focus-within:ring-[#2764de]/20"
    : isCustomTheme
      ? "border-[#ded8f4] bg-[#f5f3ff] text-[#292344] placeholder:text-[#9992ad] focus-within:bg-white focus-within:ring-[#6554c0]/20"
      : "border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus-within:bg-white focus-within:ring-blue-100";

  const tabContainerClass = isDarkTheme
    ? "bg-[#111318]"
    : isCustomTheme
      ? "bg-[#ede9fe]"
      : "bg-gray-100";

  const inactiveTabClass = isDarkTheme
    ? "text-gray-400 hover:text-gray-100"
    : isCustomTheme
      ? "text-[#77708e] hover:text-[#292344]"
      : "text-gray-500 hover:text-gray-800";

  const activeTabClass = isDarkTheme
    ? "bg-[#292d36] text-[#7da5ff] shadow-sm"
    : isCustomTheme
      ? "bg-white text-[#6554c0] shadow-sm"
      : "bg-white text-[#2764de] shadow-sm";

  const emptyIconClass = isDarkTheme
    ? "bg-[#252a35]"
    : isCustomTheme
      ? "bg-[#ede9fe]"
      : "bg-blue-50";

  const emptyTextClass = isDarkTheme
    ? "text-gray-300"
    : isCustomTheme
      ? "text-[#77708e]"
      : "text-gray-500";

  useEffect(() => {
    const trimmedQuery = query.trim();
    let cancelled = false;

    if (!trimmedQuery) {
      setUsers([]);
      setPosts([]);
      setCommentCounts({});
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const timer = setTimeout(async () => {
      try {
        if (activeTab === "people") {
          const results = await searchUsers(trimmedQuery);

          if (!cancelled) {
            setUsers(results);
            setPosts([]);
          }
        } else {
          const results = await searchPosts(trimmedQuery);

          if (cancelled) return;

          setPosts(results);
          setUsers([]);

          const counts = await Promise.all(
            results.map(async (post) => {
              try {
                const count = await getCommentCount(post._id);
                return [post._id, count];
              } catch {
                return [post._id, 0];
              }
            }),
          );

          if (!cancelled) {
            setCommentCounts(Object.fromEntries(counts));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Something went wrong.");
          setUsers([]);
          setPosts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, activeTab]);

  useEffect(() => {
    let cancelled = false;

    const loadFollowStatuses = async () => {
      const people =
        activeTab === "people"
          ? users
          : posts.map((post) => post.user).filter(Boolean);

      const userIds = [
        ...new Set(
          people
            .map((person) => person?._id)
            .filter((id) => id && id !== user?.id),
        ),
      ];

      if (userIds.length === 0) return;

      const results = await Promise.all(
        userIds.map(async (userId) => {
          try {
            const data = await getFollowStatus(userId);
            return [userId, data.isFollowing];
          } catch (error) {
            console.error("Failed to load follow status:", error);
            return [userId, false];
          }
        }),
      );

      if (!cancelled) {
        setFollowStatuses((prev) => ({
          ...prev,
          ...Object.fromEntries(results),
        }));
      }
    };

    loadFollowStatuses();

    return () => {
      cancelled = true;
    };
  }, [users, posts, activeTab, user?.id]);

  useEffect(() => {
    let active = true;

    const loadMentionUsers = async () => {
      try {
        const results = await getMentionUsers();

        if (active) {
          setMentionUsers(Array.isArray(results) ? results : []);
        }
      } catch (error) {
        console.error("Failed to load mention users:", error);
      }
    };

    loadMentionUsers();

    return () => {
      active = false;
    };
  }, []);

  const openProfile = (userId) => {
    if (userId) {
      navigate(`/userDetails/${userId}`);
    }
  };

  const formatDate = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleLike = async (postId) => {
    if (likingPosts[postId]) return;

    setLikingPosts((prev) => ({ ...prev, [postId]: true }));

    try {
      const res = await fetch(`http://localhost:5000/posts/like/${postId}`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update like");
      }

      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId
            ? {
              ...post,
              isLikedByUser: data.liked,
              likes: Array(data.likesCount).fill(null),
            }
            : post,
        ),
      );
    } catch (error) {
      toast.error(error.message || "Failed to update like");
    } finally {
      setLikingPosts((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleSavePost = async (postId) => {
    if (savingPosts[postId]) return;

    setSavingPosts((prev) => ({ ...prev, [postId]: true }));

    try {
      const data = await toggleSavePost(postId);

      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId ? { ...post, isSavedByUser: data.saved } : post,
        ),
      );

      toast.success(
        data.saved
          ? "Post saved successfully"
          : "Post removed from saved posts",
      );
    } catch (error) {
      toast.error(error.message || "Failed to save post");
    } finally {
      setSavingPosts((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleFollowToggle = async (person) => {
    const personId = person?._id;

    if (!personId || followLoading[personId]) return;

    const isFollowing = Boolean(followStatuses[personId]);

    setFollowLoading((prev) => ({ ...prev, [personId]: true }));

    try {
      if (isFollowing) {
        await unfollowUser(personId);
        setFollowStatuses((prev) => ({ ...prev, [personId]: false }));
        toast.success(`You unfollowed ${person.name || "this user"}`);
      } else {
        await followUser(personId);
        setFollowStatuses((prev) => ({ ...prev, [personId]: true }));
        toast.success(`You are now following ${person.name || "this user"}`);
      }
    } catch (error) {
      toast.error(error.message || "Failed to update follow status");
    } finally {
      setFollowLoading((prev) => ({ ...prev, [personId]: false }));
    }
  };

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
          content.slice(mention.start, mention.end).startsWith("@"),
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
              <span className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity duration-150 group-hover/mention:visible group-hover/mention:opacity-100 group-focus-within/mention:visible group-focus-within/mention:opacity-100">
                <Link
                  to={profileUrl}
                  className={`flex w-56 items-center gap-3 rounded-xl border p-3 text-left shadow-xl ${isDarkTheme
                      ? "border-[#343843] bg-[#1b1e25]"
                      : isCustomTheme
                        ? "border-[#ded8f4] bg-white"
                        : "border-gray-200 bg-white"
                    }`}
                >
                  <img
                    src={person.avatar || "/avatar.png"}
                    alt={person.name || mentionText.slice(1)}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />

                  <span className="min-w-0">
                    <span
                      className={`block truncate text-sm font-semibold ${headerTitleClass}`}
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
          </span>,
        );
      }

      lastIndex = mention.end;
    });

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div
      className={`mx-auto min-h-screen w-full max-w-2xl pb-24 pt-20 md:pb-8 md:pt-6 ${pageBackgroundClass}`}
    >
      <div className={`relative z-10 border-b px-4 py-5 ${headerClass}`}>
        <h1 className={`text-2xl font-bold ${headerTitleClass}`}>Search</h1>

        <p className={`mt-1 text-sm ${headerSubtitleClass}`}>
          Discover people and posts on Postora.
        </p>

        <div
          className={`mt-5 flex items-center gap-3 rounded-2xl border px-4 transition focus-within:border-[#2764de] focus-within:ring-2 ${inputClass}`}
        >
          <SearchIcon size={21} className="shrink-0 text-gray-400" />

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              activeTab === "people"
                ? "Search people by name..."
                : "Search posts by keywords..."
            }
            aria-label={
              activeTab === "people" ? "Search people" : "Search posts"
            }
            className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none"
          />

          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className={`rounded-full p-1 transition ${isDarkTheme
                  ? "text-gray-400 hover:bg-[#343843] hover:text-white"
                  : isCustomTheme
                    ? "text-[#77708e] hover:bg-[#ede9fe]"
                    : "text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                }`}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className={`mt-5 grid grid-cols-2 gap-2 rounded-xl p-1 ${tabContainerClass}`}>
          <button
            type="button"
            onClick={() => setActiveTab("people")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition ${activeTab === "people" ? activeTabClass : inactiveTabClass
              }`}
          >
            <Users size={18} />
            People
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("posts")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition ${activeTab === "posts" ? activeTabClass : inactiveTabClass
              }`}
          >
            <FileText size={18} />
            Posts
          </button>
        </div>
      </div>

      <div className="px-4">
        {!query.trim() ? (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <div
              className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${emptyIconClass}`}
            >
              <SearchIcon size={30} className="text-[#2764de]" />
            </div>

            <h2 className={`text-lg font-bold ${headerTitleClass}`}>
              {activeTab === "people" ? "Find your people" : "Discover posts"}
            </h2>

            <p className={`mt-2 max-w-sm text-sm leading-6 ${emptyTextClass}`}>
              {activeTab === "people"
                ? "Search for people on Postora by entering their name."
                : "Search for posts by entering words or phrases."}
            </p>
          </div>
        ) : loading ? (
          <div
            className={`flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 px-4 ${isDarkTheme
                ? "bg-[#111318]"
                : isCustomTheme
                  ? "bg-[#f5f3ff]"
                  : "bg-gray-50"
              }`}
            role="status"
            aria-live="polite"
            aria-label="Loading profile"
          >
            <img
              src={isDarkTheme ? "/logo.png" : "/logo-1.png"}
              alt="Postora"
              className="h-auto w-36 max-w-[55vw] object-contain sm:w-44"
            />

            <div className="relative flex h-10 w-10 items-center justify-center">
              <span
                className={`absolute inset-0 rounded-full border-[3px] ${isDarkTheme
                    ? "border-[#343843]"
                    : isCustomTheme
                      ? "border-[#ded8f4]"
                      : "border-gray-200"
                  }`}
              />

              <span
                className={`absolute inset-0 animate-spin rounded-full border-[3px] border-transparent ${isCustomTheme
                    ? "border-t-[#6554c0]"
                    : "border-t-[#2764de]"
                  }`}
              />
            </div>

            <span
              className={`text-sm font-medium tracking-wide ${isDarkTheme
                  ? "text-[#9ca3af]"
                  : isCustomTheme
                    ? "text-[#77718f]"
                    : "text-gray-500"
                }`}
            >
              Searching...
            </span>
          </div>
        ) : error ? (
          <div className="py-14 text-center">
            <p className="font-semibold text-red-500">{error}</p>
            <p className={`mt-2 text-sm ${emptyTextClass}`}>
              Please try searching again.
            </p>
          </div>
        ) : activeTab === "people" ? (
          users.length > 0 ? (
            <div className={`divide-y ${separatorClass.replace("border-", "divide-")}`}>
              <p className={`py-4 text-sm ${headerSubtitleClass}`}>
                {users.length} {users.length === 1 ? "person" : "people"} found
              </p>

              {users.map((person) => (
                <div
                  key={person._id}
                  className={`flex items-center gap-3 rounded-xl px-2 py-4 transition ${isDarkTheme
                      ? "hover:bg-[#1b1e25]"
                      : isCustomTheme
                        ? "hover:bg-[#ede9fe]"
                        : "hover:bg-blue-50"
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => openProfile(person._id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <img
                      src={person.avatar || "/avatar.png"}
                      alt=""
                      className={`h-12 w-12 shrink-0 rounded-full border object-cover ${avatarBorderClass}`}
                    />

                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-semibold ${headerTitleClass}`}>
                        {person.name || "Postora User"}
                      </p>
                      <p className={`mt-1 text-sm ${headerSubtitleClass}`}>
                        View profile
                      </p>
                    </div>
                  </button>

                  {person._id !== user?.id && (
                    <button
                      type="button"
                      disabled={!!followLoading[person._id]}
                      onClick={() => handleFollowToggle(person)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${followStatuses[person._id]
                          ? isDarkTheme
                            ? "border-[#343843] bg-[#1b1e25] text-gray-200 hover:text-red-400"
                            : isCustomTheme
                              ? "border-[#ded8f4] bg-white text-[#292344] hover:text-red-600"
                              : "border-gray-200 bg-white text-gray-700 hover:border-red-200 hover:text-red-600"
                          : "border-[#2764de] bg-[#2764de] text-white hover:bg-blue-700"
                        }`}
                    >
                      {followStatuses[person._id] ? (
                        <UserCheck size={16} />
                      ) : (
                        <UserPlus size={16} />
                      )}

                      {followStatuses[person._id] ? "Following" : "Follow"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <Users size={32} className={`mx-auto ${emptyTextClass}`} />
              <h2 className={`mt-3 font-semibold ${headerTitleClass}`}>
                No people found
              </h2>
              <p className={`mt-1 text-sm ${headerSubtitleClass}`}>
                Try another name.
              </p>
            </div>
          )
        ) : posts.length > 0 ? (
          <div className={`divide-y ${separatorClass.replace("border-", "divide-")}`}>
            <p className={`py-4 text-sm ${headerSubtitleClass}`}>
              {posts.length} matching {posts.length === 1 ? "post" : "posts"}
            </p>

            {posts.map((post) => (
              <article
                key={post._id}
                className={`group/post relative mb-3 mt-3 flex gap-3 rounded-xl border p-3 transition-all duration-300 sm:p-5 ${postCardClass}`}
              >
                <div className="flex w-full items-start gap-3">
                  <button
                    type="button"
                    onClick={() => openProfile(post.user?._id)}
                    className="shrink-0"
                    aria-label={`View ${post.user?.name || "user"}'s profile`}
                  >
                    <img
                      src={post.user?.avatar || "/avatar.png"}
                      alt=""
                      className={`h-11 w-11 rounded-full border object-cover ${avatarBorderClass}`}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openProfile(post.user?._id)}
                          className={`block max-w-full truncate text-left text-sm font-semibold transition ${nameTextClass}`}
                        >
                          {post.user?.name || "Postora User"}
                        </button>

                        <p className={`mt-0.5 flex items-center gap-1 text-xs ${dateTextClass}`}>
                          <CalendarDays size={13} />
                          {formatDate(post.createdAt)}
                        </p>
                      </div>

                      {post.user?._id && post.user._id !== user?.id && (
                        <button
                          type="button"
                          disabled={!!followLoading[post.user._id]}
                          onClick={() => handleFollowToggle(post.user)}
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 sm:px-4 sm:py-2 ${followStatuses[post.user._id]
                              ? isDarkTheme
                                ? "border border-[#343843] bg-[#1b1e25] text-gray-100 hover:bg-[#292d36]"
                                : isCustomTheme
                                  ? "border border-[#ded8f4] bg-white text-[#292344] hover:bg-[#f0edfa]"
                                  : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                              : "bg-[#2764de] text-white hover:bg-blue-700"
                            }`}
                        >
                          {followStatuses[post.user._id] ? (
                            <UserCheck size={15} />
                          ) : (
                            <UserPlus size={15} />
                          )}
                          {followStatuses[post.user._id] ? "Following" : "Follow"}
                        </button>
                      )}
                    </div>

                    {post?.text && (
                      <p className={`mt-3 whitespace-pre-wrap break-words text-sm leading-7 sm:text-[15px] ${postTextClass}`}>
                        {renderPostText(post.text, post.mentions || [])}
                      </p>
                    )}

                    {post?.image && (
                      <button
                        type="button"
                        onClick={() => setSelectedImage(post.image)}
                        aria-label="Open post image"
                        className="mt-3 block w-full cursor-pointer overflow-hidden rounded-xl text-left"
                      >
                        <img
                          src={post.image}
                          alt="Post"
                          className="max-h-[600px] w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    )}

                    {post?.video && (
                      <div className="mt-3 overflow-hidden rounded-xl">
                        <video
                          src={post.video}
                          controls
                          playsInline
                          preload="metadata"
                          className="max-h-[600px] w-full rounded-xl bg-black"
                        >
                          Your browser does not support video playback.
                        </video>
                      </div>
                    )}

                    <div className={`mt-4 flex flex-wrap items-center gap-2 border-t pt-3 text-sm sm:gap-4 ${separatorClass}`}>
                      <button
                        type="button"
                        disabled={!!likingPosts[post._id]}
                        onClick={() => handleLike(post._id)}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 transition-colors disabled:opacity-50 ${post.isLikedByUser
                            ? "text-red-500"
                            : `${actionTextClass} hover:bg-red-50 hover:text-red-500`
                          }`}
                      >
                        <Heart
                          size={20}
                          className={post.isLikedByUser ? "fill-current" : ""}
                        />
                        <span>{post.likes?.length || 0}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setShowComments((prev) => ({
                            ...prev,
                            [post._id]: !prev[post._id],
                          }))
                        }
                        className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 transition-colors ${showComments[post._id]
                            ? "bg-[#2764de]/10 text-[#2764de]"
                            : `${actionTextClass} hover:bg-[#2764de]/10 hover:text-[#2764de]`
                          }`}
                      >
                        <MessageCircle size={20} />
                        <span>{commentCounts[post._id] || 0}</span>
                      </button>

                      <button
                        type="button"
                        disabled={!!savingPosts[post._id]}
                        onClick={() => handleSavePost(post._id)}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 transition-colors disabled:opacity-50 ${post.isSavedByUser
                            ? isDarkTheme
                              ? "text-[#7da5ff]"
                              : isCustomTheme
                                ? "text-[#6554c0]"
                                : "text-[#2764de]"
                            : `${actionTextClass} hover:bg-[#2764de]/10 hover:text-[#2764de]`
                          }`}
                        aria-label={post.isSavedByUser ? "Unsave post" : "Save post"}
                      >
                        <Bookmark
                          size={20}
                          className={post.isSavedByUser ? "fill-current" : ""}
                        />
                        <span>{post.isSavedByUser ? "Saved" : "Save"}</span>
                      </button>
                    </div>

                    {showComments[post._id] && (
                      <div className={`mt-3 border-t pt-3 ${separatorClass}`}>
                        <CommentsSection
                          postId={post._id}
                          showComments={showComments[post._id]}
                          commentsCount={commentCounts[post._id] || 0}
                          onCountChange={(count) =>
                            setCommentCounts((prev) => ({
                              ...prev,
                              [post._id]: count,
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <FileText size={32} className={`mx-auto ${emptyTextClass}`} />
            <h2 className={`mt-3 font-semibold ${headerTitleClass}`}>
              No posts found
            </h2>
            <p className={`mt-1 text-sm ${headerSubtitleClass}`}>
              Try different keywords.
            </p>
          </div>
        )}

        {selectedImage && (
          <ImageViewer
            src={selectedImage}
            alt="Post image"
            onClose={() => setSelectedImage(null)}
          />
        )}
      </div>
    </div>
  );
}

export default Search;