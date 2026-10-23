import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bookmark,
  Heart,
  MessageCircle,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { getSavedPosts, toggleSavePost } from "../api/posts";
import CommentsSection from "../components/CommentsSection";
import { getCommentCount } from "../api/comments";
import ImageViewer from "../components/ImageViewer";
import { useAuth } from "../api/authContext/UserContext";
import {
  getFollowStatus,
  followUser,
  unfollowUser,
  getMentionUsers,
} from "../api/follows";

function SavedPosts() {
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const dividerClass = isDarkTheme
    ? "divide-[#343843]"
    : isCustomTheme
      ? "divide-[#ded8f4]"
      : "divide-gray-100";

  useEffect(() => {
    let cancelled = false;

    const fetchSavedPosts = async () => {
      try {
        const results = await getSavedPosts();

        if (cancelled) return;

        setPosts(results);

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
      } catch (error) {
        if (!cancelled) {
          toast.error(error.message || "Failed to load saved posts");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchSavedPosts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadFollowStatuses = async () => {
      const userIds = [
        ...new Set(
          posts
            .map((post) => post.user?._id)
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
  }, [posts, user?.id]);


  useEffect(() => {
    let active = true;

    const loadMentionUsers = async () => {
      try {
        const users = await getMentionUsers();

        if (active) {
          setMentionUsers(Array.isArray(users) ? users : []);
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

    return new Date(date).toLocaleDateString("en-US", {
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

  const handleUnsave = async (postId) => {
    if (savingPosts[postId]) return;

    setSavingPosts((prev) => ({ ...prev, [postId]: true }));

    try {
      await toggleSavePost(postId);

      setPosts((prev) => prev.filter((post) => post._id !== postId));

      toast.success("Post removed from saved posts");
    } catch (error) {
      toast.error(error.message || "Failed to remove saved post");
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
                      className={`block truncate text-sm font-semibold ${isDarkTheme
                        ? "text-gray-100"
                        : isCustomTheme
                          ? "text-[#292344]"
                          : "text-gray-900"
                        }`}
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

  if (loading) {
  return (
    <div
      className={`flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 px-4 ${
        isDarkTheme
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
          className={`absolute inset-0 rounded-full border-[3px] ${
            isDarkTheme
              ? "border-[#343843]"
              : isCustomTheme
                ? "border-[#ded8f4]"
                : "border-gray-200"
          }`}
        />

        <span
          className={`absolute inset-0 animate-spin rounded-full border-[3px] border-transparent ${
            isCustomTheme
              ? "border-t-[#6554c0]"
              : "border-t-[#2764de]"
          }`}
        />
      </div>

      <span
        className={`text-sm font-medium tracking-wide ${
          isDarkTheme
            ? "text-[#9ca3af]"
            : isCustomTheme
              ? "text-[#77718f]"
              : "text-gray-500"
        }`}
      >
        Loading Saved Posts...
      </span>
    </div>
  );
}

  return (
    <div
      className={`mx-auto min-h-screen w-full max-w-2xl pb-24 pt-20 md:pb-8 md:pt-6 ${pageBackgroundClass}`}
    >
      {" "}
      <div
        className={`relative z-10 border-b px-4 py-5 ${headerClass}`}
      >
        <div className="flex items-center gap-3">
          <Bookmark size={26} className="text-[#2764de]" />

          <div>
            <h1 className={`text-2xl font-bold ${headerTitleClass}`}>
              Saved Posts
            </h1>
            <p className={`mt-1 text-sm ${headerSubtitleClass}`}>
              Posts you've saved for later.
            </p>
          </div>
        </div>
      </div>
      <div className="px-4">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <div
              className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isDarkTheme
                ? "bg-[#252a35]"
                : isCustomTheme
                  ? "bg-[#ede9fe]"
                  : "bg-blue-50"
                }`}
            >
              <Bookmark size={30} className="text-[#2764de]" />
            </div>

            <h2 className={`text-lg font-bold ${headerTitleClass}`}>
              No saved posts yet
            </h2>

            <p
              className={`mt-2 max-w-sm text-sm leading-6 ${headerSubtitleClass}`}
            >
              Save posts from your feed and they'll appear here.
            </p>
          </div>
        ) : (
          <div className={`divide-y ${dividerClass}`}>
            <p className={`py-4 text-sm ${dateTextClass}`}>
              {posts.length} saved {posts.length === 1 ? "post" : "posts"}
            </p>

            {posts.map((post) => (
              <article
                key={post._id}
                className={`group/post relative mt-3 mb-3 flex gap-3 rounded-xl border p-3 transition-all duration-300 sm:p-5 ${postCardClass}`}
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
                      className={`h-11 w-11 rounded-full border object-cover ${postAvatarBorderClass}`}
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

                        <p className={`mt-0.5 text-xs ${dateTextClass}`}>
                          {formatDate(post.createdAt)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {post.user?._id && post.user._id !== user?.id && (
                          <button
                            type="button"
                            disabled={!!followLoading[post.user._id]}
                            onClick={() => handleFollowToggle(post.user)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 sm:px-4 sm:py-2 ${followStatuses[post.user._id]
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

                            {followStatuses[post.user._id]
                              ? "Following"
                              : "Follow"}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={!!savingPosts[post._id]}
                          onClick={() => handleUnsave(post._id)}
                          className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm transition disabled:opacity-50 ${isDarkTheme
                              ? "text-[#7da5ff] hover:bg-[#252a35]"
                              : isCustomTheme
                                ? "text-[#6554c0] hover:bg-[#ede9fe]"
                                : "text-[#2764de] hover:bg-blue-50"
                            }`}
                          aria-label="Remove saved post"
                        >
                          <Bookmark size={18} fill="currentColor" />
                          <span>Saved</span>
                        </button>
                      </div>
                    </div>

                    {post?.text && (
                      <p
                        className={`mt-3 whitespace-pre-wrap break-words text-sm leading-7 sm:text-[15px] ${postTextClass}`}
                      >
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

                    <div
                      className={`mt-4 flex flex-wrap items-center gap-2 border-t pt-3 text-sm sm:gap-4 ${postSeparatorClass}`}
                    >
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
                    </div>

                    {showComments[post._id] && (
                      <div
                        className={`mt-3 border-t pt-3 ${postSeparatorClass}`}
                      >
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

export default SavedPosts;

