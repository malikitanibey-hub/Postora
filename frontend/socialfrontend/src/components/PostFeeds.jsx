import {
  Heart,
  MessageCircle,
  Bookmark,
  UserPlus,
  UserCheck,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import CommentsSection from "./CommentsSection";
import { getCommentCount } from "../api/comments";
import { toggleSavePost } from "../api/posts";
import AutoPlayVideo from "./AutoPlayVideo";
import ImageViewer from "./ImageViewer";
import { useAuth } from "../api/authContext/UserContext";
import {
  getFollowStatus,
  followUser,
  unfollowUser,
  getMentionUsers,
} from "../api/follows";

function PostFeeds({ notificationTarget, activeTab }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expandedPosts, setExpandedPosts] = useState({});
  const [isPending, startTransition] = useTransition();
  const [showComments, setShowComments] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [focusCommentIds, setFocusCommentIds] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [followStatuses, setFollowStatuses] = useState({});
  const [followLoading, setFollowLoading] = useState({});
  const [mentionUsers, setMentionUsers] = useState([]);
  const { user } = useAuth();
  const [appearance, setAppearance] = useState(
    () => localStorage.getItem("postoraAppearance") || "light"
  );
  const [optimisticPosts, setOptimisticPosts] = useOptimistic(
    posts,
    (state, { postId, liked, likesCount }) => {
      return state.map((post) =>
        post._id === postId
          ? {
            ...post,
            likes: Array(likesCount).fill(null),
            isLikedByUser: liked,
          }
          : post,
      );
    },
  );

  const handleLike = async (postId, currentLikesCount, isCurrentlyLiked) => {
    const newLiked = !isCurrentlyLiked;
    const newLikesCount = newLiked
      ? currentLikesCount + 1
      : currentLikesCount - 1;

    startTransition(async () => {
      setOptimisticPosts({
        postId,
        liked: newLiked,
        likesCount: newLikesCount,
      });

      try {
        const res = await fetch(`http://localhost:5000/posts/like/${postId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post._id === postId
              ? {
                ...post,
                likes: Array(data.likesCount).fill(null),
                isLikedByUser: data.liked,
              }
              : post,
          ),
        );
      } catch (error) {
        // Roll back optimistic update
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post._id === postId
              ? {
                ...post,
                likes: Array(currentLikesCount).fill(null),
                isLikedByUser: isCurrentlyLiked,
              }
              : post,
          ),
        );

        toast.error("Failed to update like");
        loadPosts();
      }
    });
  };

  const togglePost = (postId) => {
    setExpandedPosts((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const res = await fetch("http://localhost:5000/posts", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!Array.isArray(data)) {
        throw new Error("The posts API did not return an array");
      }

      setPosts(data);
      setLoading(false);

      // Load follow status for each unique post author.
      const currentUserId = user?.id || user?._id;

      const authorIds = [
        ...new Set(
          data
            .map((post) => post.user?._id)
            .filter((authorId) => authorId && authorId !== currentUserId)
        ),
      ];

      if (user && authorIds.length > 0) {
        const statuses = await Promise.all(
          authorIds.map(async (authorId) => {
            try {
              const status = await getFollowStatus(authorId);
              return [authorId, status];
            } catch (error) {
              console.error(
                `Failed to load follow status for ${authorId}:`,
                error
              );
              return [authorId, null];
            }
          })
        );

        setFollowStatuses((prev) => ({
          ...prev,
          ...Object.fromEntries(
            statuses.filter(([, status]) => status !== null)
          ),
        }));
      }

      //count post
      const counts = {};
      await Promise.all(
        data.map(async (post) => {
          try {
            counts[post._id] = await getCommentCount(post._id);
          } catch (error) {
            console.error(
              `Failed to load comment count for post ${post._id}:`,
              error,
            );
            counts[post._id] = 0;
          }
        }),
      );
      setCommentCounts(counts);
    } catch (error) {
      console.error("Failed to load posts:", error);
      setErr(error.message || "Error  While Loading Posts");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);


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

  // Keep the post cards in sync with the active theme.
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

  const isDarkTheme = appearance === "dark";
    const isCustomTheme = appearance === "custom";

  // Dark mode matches the "What's happening" composer exactly:
  // dark card surface with the same full border.
  const postCardClass = isDarkTheme
    ? "bg-[#1b1e25] border-[#343843] text-gray-100"
    : "text-[var(--foreground)]";

  const postAvatarBorderClass = isDarkTheme
    ? "border-[#343843]"
    : "border-gray-200";

  const postSeparatorClass = isDarkTheme
    ? "border-[#343843]"
    : isCustomTheme
      ? "border-[#ded8f4]"
      : "border-gray-300";

  useEffect(() => {
    const target = notificationTarget;

    if (!target?.openPostId || loading || !posts.length) {
      return;
    }

    const postExists = posts.some((post) => post._id === target.openPostId);

    if (!postExists) {
      toast.error("This post could not be found in your feed.");
      navigate(location.pathname, {
        replace: true,
        state: null,
      });
      return;
    }

    // Open comments automatically for comment/reply notifications.
    if (target.focusCommentId) {
      setShowComments((prev) => ({
        ...prev,
        [target.openPostId]: true,
      }));
    }

    setFocusCommentIds((prev) => ({
      ...prev,
      [target.openPostId]: target.focusCommentId,
    }));

    // Wait for React to render the target post and comments.
    requestAnimationFrame(() => {
      document.getElementById(`post-${target.openPostId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    // Clear the destination so it doesn't run again on later renders.
    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [notificationTarget, loading, posts, navigate, location.pathname]);

  // Toggle comments visibility
  const toggleComments = (postId) => {
    setShowComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleFollowToggle = async (authorId) => {
    if (!authorId || followLoading[authorId]) return;

    const currentStatus = followStatuses[authorId];

    setFollowLoading((prev) => ({
      ...prev,
      [authorId]: true,
    }));

    try {
      if (currentStatus?.isFollowing) {
        await unfollowUser(authorId);

        setFollowStatuses((prev) => ({
          ...prev,
          [authorId]: {
            ...prev[authorId],
            followersCount: Math.max(
              0,
              (prev[authorId]?.followersCount || 0) - 1
            ),
            isFollowing: false,
          },
        }));

        toast.success(`You unfollowed ${posts.find((post) => post.user?._id === authorId)?.user?.name || "this user"}`);
      } else {
        await followUser(authorId);

        setFollowStatuses((prev) => ({
          ...prev,
          [authorId]: {
            ...prev[authorId],
            followersCount:
              (prev[authorId]?.followersCount || 0) + 1,
            followingCount:
              prev[authorId]?.followingCount || 0,
            isFollowing: true,
          },
        }));

        toast.success(`You followed ${posts.find((post) => post.user?._id === authorId)?.user?.name || "this user"}`);
      }
    } catch (error) {
      toast.error(error.message || "Failed to update follow status");
    } finally {
      setFollowLoading((prev) => ({
        ...prev,
        [authorId]: false,
      }));
    }
  };

  const renderPostText = (content, mentions = []) => {
    if (!content) return content;

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

    const getId = (person) =>
      String(person?._id || person?.id || person || "");

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
                  className="flex w-56 items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-3 text-left shadow-xl"
                >
                  <img
                    src={person.avatar || "/avatar.png"}
                    alt={person.name || mentionText.slice(1)}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />

                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">
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

  const visiblePosts =
    activeTab === "following"
      ? optimisticPosts.filter(
        (post) => followStatuses[post.user?._id]?.isFollowing
      )
      : optimisticPosts;

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
        Loading...
      </span>
    </div>
  );
}

  if (err) {
    return <div className="p-4 text-sm text-red-600">{err}</div>;
  }

  if (!visiblePosts.length) {
    return (
      <div className="flex items-center justify-center py-10 text-center text-gray-500">
        {activeTab === "following"
          ? "No posts from people you follow yet."
          : "No Posts Yet..."}
      </div>
    );
  }

  const handleSavePost = async (postId) => {
    try {
      const result = await toggleSavePost(postId);

      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post._id === postId ? { ...post, isSavedByUser: result.saved } : post,
        ),
      );

      toast.success(
        result.saved
          ? "Post saved successfully"
          : "Post removed from saved posts",
      );
    } catch (error) {
      toast.error(error.message || "Failed to save post");
    }
  };


  return (
    <div>
      {visiblePosts?.map((post) => (
        <article
          id={`post-${post._id}`}
          key={post._id}
          className={`group/post relative mb-3 flex gap-3 rounded-xl border p-3 transition-all duration-300 sm:p-5 ${postCardClass}`}
        >
          {" "}
          <Link to={`/userDetails/${post?.user?._id}`}>
            <img
              src={post?.user?.avatar || "/avatar.png"}
              className={`h-11 w-11 shrink-0 cursor-pointer rounded-full border object-cover transition-transform duration-200 group-hover/post:scale-[1.03] ${postAvatarBorderClass}`}
            />
          </Link>
          <div className="flex-1">
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3 py-1">
              <div className="min-w-0">
                <Link
                  to={`/userDetails/${post?.user?._id}`}
                  className="font-semibold text-[var(--foreground)] hover:underline"
                >
                  {post?.user?.name}
                </Link>

                <span className="mt-0.5 block text-sm text-gray-500">
                  {new Date(post?.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              {user &&
                post?.user?._id &&
                post.user._id !== (user.id || user._id) && (
                  <button
                    type="button"
                    onClick={() => handleFollowToggle(post.user._id)}
                    disabled={
                      !!followLoading[post.user._id] ||
                      !followStatuses[post.user._id]
                    }
                    className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm ${followStatuses[post.user._id]?.isFollowing
                      ? "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--background)]"
                      : "bg-[#2764de] text-white hover:bg-blue-700"
                      }`}
                  >
                    {followStatuses[post.user._id]?.isFollowing ? (
                      <UserCheck size={16} />
                    ) : (
                      <UserPlus size={16} />
                    )}

                    {followLoading[post.user._id]
                      ? "Please wait..."
                      : followStatuses[post.user._id]?.isFollowing
                        ? "Following"
                        : "Follow"}
                  </button>
                )}
            </div>

            {post?.text && (
              <div className="py-2 pr-1 text-sm leading-7 text-[var(--foreground)] sm:pr-3 sm:text-[15px]">
                <p className="whitespace-pre-wrap break-words">
                  {expandedPosts[post._id] ? (
                    renderPostText(post.text, post.mentions || [])
                  ) : post.text.length > 180 ? (
                    <>
                      {renderPostText(
                        post.text.slice(0, 180),
                        (post.mentions || []).filter(
                          (mention) => mention.end <= 180,
                        ),
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
                    className="mt-1 font-semibold text-primary hover:underline"
                  >
                    {expandedPosts[post._id] ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            )}

            {/* Post Image */}
            {post?.image && (
              <button
                type="button"
                onClick={() => setSelectedImage(post.image)}
                aria-label="Open post image"
                className="max-h-[600px] w-full object-contain transition-transform duration-300"
              >
                <img
                  src={post.image}
                  alt="Post"
                  className="max-h-[600px] w-full object-cover"
                  loading="lazy"
                />
              </button>
            )}

            {/* Post Video */}
            {post.video && (
              <AutoPlayVideo
                src={post.video}
                className="max-h-[500px] w-full rounded-lg object-contain"
              />
            )}

            <div className={`mt-4 flex flex-wrap items-center gap-2 border-t pt-3 text-sm text-[var(--foreground)]/70 sm:gap-4 ${postSeparatorClass}`}>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isPending}
                onClick={() =>
                  handleLike(
                    post._id,
                    Array.isArray(post?.likes) ? post?.likes.length : 0,
                    !!post.isLikedByUser,
                  )
                }
              >
                <Heart
                  className={
                    post?.isLikedByUser
                      ? "fill-red-500 text-red-500"
                      : "text-gray-500"
                  }
                />
                <span
                  className={
                    post?.isLikedByUser
                      ? "fill-red-500 text-red-500"
                      : "text-gray-500"
                  }
                >
                  {Array.isArray(post?.likes) ? post?.likes.length : 0}
                </span>
              </button>

              {/* Comment Button  comes from CommentsSection.jsx */}
              <button
                onClick={() => toggleComments(post?._id)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-blue-50 hover:text-[#2764de] ${showComments[post?._id] ? "bg-blue-50 text-[#2764de]" : "text-gray-500"
                  }`}
              >
                <MessageCircle
                  className={
                    showComments[post?._id]
                      ? "text-[#2764de]"
                      : "text-gray-500"
                  }
                />
                <span
                  className={
                    showComments[post?._id]
                      ? "text-[#2764de]"
                      : "text-gray-500"
                  }
                >
                  {commentCounts[post._id] || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSavePost(post._id)}
                className={`ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 transition-colors ${post.isSavedByUser
                  ? "bg-blue-50 text-[#2764de]"
                  : "text-gray-500 hover:bg-blue-50 hover:text-[#2764de]"
                  }`}
                aria-label={post.isSavedByUser ? "Unsave post" : "Save post"}
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
              focusCommentId={focusCommentIds[post._id] || null}
              onCountChange={(count) => {
                setCommentCounts((prev) => ({
                  ...prev,
                  [post._id]: count,
                }));
              }}
            />
          </div>
        </article>
      ))}

      {/* Full-screen Image Preview */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setSelectedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            aria-label="Close image preview"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-3xl text-white transition hover:bg-white/25"
          >
            &times;
          </button>

          <img
            src={selectedImage}
            alt="Full-size post"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
          />
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
  );
}

export default PostFeeds;

