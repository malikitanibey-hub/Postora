import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  CalendarDays,
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
import { Link } from "react-router-dom";

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

  const { user } = useAuth();

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
                  className="flex w-56 items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-xl"
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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-[#2764de]" />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl bg-white pb-24 pt-20 md:pb-8 md:pt-6">
      {" "}
      <div className="relative z-10 border-b border-gray-200 bg-white px-4 py-5">
        <div className="flex items-center gap-3">
          <Bookmark size={26} className="text-[#2764de]" />

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Saved Posts</h1>
            <p className="mt-1 text-sm text-gray-500">
              Posts you've saved for later.
            </p>
          </div>
        </div>
      </div>
      <div className="px-4">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <Bookmark size={30} className="text-[#2764de]" />
            </div>

            <h2 className="text-lg font-bold text-gray-900">
              No saved posts yet
            </h2>

            <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
              Save posts from your feed and they'll appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <p className="py-4 text-sm text-gray-500">
              {posts.length} saved {posts.length === 1 ? "post" : "posts"}
            </p>

            {posts.map((post) => (
              <article key={post._id} className="py-5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openProfile(post.user?._id)}
                    className="shrink-0"
                    aria-label={`View ${post.user?.name || "user"}'s profile`}
                  >
                    <img
                      src={post.user?.avatar || "/avatar.png"}
                      alt=""
                      className="h-10 w-10 rounded-full border border-gray-200 object-cover"
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => openProfile(post.user?._id)}
                      className="block max-w-full truncate text-left text-sm font-bold text-gray-900 hover:text-[#2764de]"
                    >
                      {post.user?.name || "Postora User"}
                    </button>

                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      <CalendarDays size={13} />
                      {formatDate(post.createdAt)}
                    </p>
                  </div>

                  {post.user?._id && post.user._id !== user?.id && (
                    <button
                      type="button"
                      disabled={!!followLoading[post.user._id]}
                      onClick={() => handleFollowToggle(post.user)}
                      className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${followStatuses[post.user._id]
                        ? "border-gray-200 text-gray-700 hover:border-red-200 hover:text-red-600"
                        : "border-[#2764de] bg-[#2764de] text-white hover:bg-blue-700"
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

                  <button
                    type="button"
                    disabled={!!savingPosts[post._id]}
                    onClick={() => handleUnsave(post._id)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-[#2764de] transition hover:bg-blue-50 disabled:opacity-50"
                    aria-label="Remove saved post"
                  >
                    <Bookmark size={18} fill="currentColor" />
                    <span>Saved</span>
                  </button>
                </div>

                {post?.text && (
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">
                    {renderPostText(post.text, post.mentions || [])}
                  </p>
                )}

                {/* Post Image */}
                {post?.image && (
                  <button
                    type="button"
                    onClick={() => setSelectedImage(post.image)}
                    aria-label="Open post image"
                    className="mt-3 block w-full cursor-pointer overflow-hidden rounded-2xl text-left"
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
                {post?.video && (
                  <div className="mt-3 overflow-hidden rounded-2xl">
                    <video
                      src={post.video}
                      controls
                      playsInline
                      preload="metadata"
                      className="max-h-[600px] w-full rounded-2xl bg-black"
                    >
                      Your browser does not support video playback.
                    </video>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-6 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    disabled={!!likingPosts[post._id]}
                    onClick={() => handleLike(post._id)}
                    className={`flex items-center gap-2 text-sm transition ${post.isLikedByUser
                      ? "text-red-500"
                      : "text-gray-500 hover:text-red-500"
                      }`}
                  >
                    <Heart
                      size={20}
                      className={post.isLikedByUser ? "fill-current" : ""}
                    />
                    <span>{post.likes?.length || 0} Likes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setShowComments((prev) => ({
                        ...prev,
                        [post._id]: !prev[post._id],
                      }))
                    }
                    className={`flex items-center gap-2 text-sm transition ${showComments[post._id]
                      ? "text-[#2764de]"
                      : "text-gray-500 hover:text-[#2764de]"
                      }`}
                  >
                    <MessageCircle size={20} />
                    <span>{commentCounts[post._id] || 0} Comments</span>
                  </button>
                </div>

                {showComments[post._id] && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
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
