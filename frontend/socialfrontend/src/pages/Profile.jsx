import React, {
  useCallback,
  useEffect,
  useState,
  useOptimistic,
  useTransition,
} from "react";
import { useAuth } from "../api/authContext/UserContext";
// import { getMeApi, updateMyAvatar  } from "../api/auth";
import { deletePost, getPostsByUser, toggleSavePost } from "../api/posts";
import {
  Heart,
  Trash,
  MessageCircle,
  Bookmark,
  Lock,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import WhatHappening from "../components/WhatHappening";
import AvatarUploader from "../components/AvatarUploader";
import { getUserProfile, updateMyAvatar, removeMyAvatar } from "../api/auth";
import CommentsSection from "../components/CommentsSection";
import { getCommentCount } from "../api/comments";
import ImageViewer from "../components/ImageViewer";
import { getFollowStatus } from "../api/follows";
import { Link } from "react-router-dom";
import { getMentionUsers } from "../api/follows";

function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState({});
  const [showComments, setShowComments] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [savingPosts, setSavingPosts] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [mentionUsers, setMentionUsers] = useState([]);
  const [followStats, setFollowStats] = useState({
    followersCount: 0,
    followingCount: 0,
  });
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
      // Optimistic update
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

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        // Update real state with server result
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
      }
    });
  };

  const togglePost = (postId) => {
    setExpandedPosts((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const toggleComments = (postId) => {
    setShowComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  useEffect(() => {
    if (!user?.id) return;

    (async () => {
      const users = await getUserProfile(user.id);
      setProfile(users);

      const myPosts = await getPostsByUser(user.id);
      setPosts(myPosts);

      const counts = {};

      await Promise.all(
        myPosts.map(async (post) => {
          try {
            const count = await getCommentCount(post._id);
            counts[post._id] = count;
          } catch (error) {
            console.error("Failed to load comment count for post", error);
          }
        }),
      );

      setCommentCounts(counts);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const loadFollowStats = async () => {
      try {
        const data = await getFollowStatus(user.id);

        if (!cancelled) {
          setFollowStats({
            followersCount: data.followersCount,
            followingCount: data.followingCount,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load follow stats:", error);
        }
      }
    };

    loadFollowStats();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);


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

  const onDelete = useCallback(async (postId) => {
    try {
      await deletePost(postId);

      setPosts((prev) => prev.filter((post) => post._id !== postId));

      toast.success("Post deleted successfully");
    } catch (error) {
      toast.error(error.message || "Failed to delete post");
    }
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await onDelete(deleteTarget);
    setDeleteTarget(null);
  };

  const handleAvatarUploaded = async (file) => {
    try {
      toast.loading("Uploading Avatar...");
      const updatedUser = await updateMyAvatar(profile._id, file);
      // setProfile((prev) => (prev ? { ...prev, avatar: url } : prev));
      setProfile(updatedUser);
      toast.success("Avatar Updated");
    } catch (error) {
      toast.error(error.message || "Failed to save avatar");
    } finally {
      toast.dismiss();
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      toast.loading("Removing Avatar...");

      const updatedUser = await removeMyAvatar(profile._id);

      setProfile(updatedUser);

      toast.success("Avatar Removed");
    } catch (error) {
      toast.error(error.message || "Failed to remove avatar");
    } finally {
      toast.dismiss();
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

  if (!profile) {
    return (
      // <div className="p-6 mt-10">Loading...</div>
      <div className="flex items-center justify-center h-40">
        <div className="w-10 h-10 border-t-primary border-4 border-gray-300 rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleSavePost = async (postId) => {
    if (savingPosts[postId]) return;

    setSavingPosts((prev) => ({ ...prev, [postId]: true }));

    try {
      const data = await toggleSavePost(postId);

      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId ? { ...post, isSavedByUser: data.saved } : post,
        ),
      );

      toast.success(data.saved ? "Post saved" : "Post unsaved");
    } catch (error) {
      toast.error(error.message || "Failed to update saved post");
    } finally {
      setSavingPosts((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const isOwner = user?.id === profile._id;
  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 pt-20 pb-24 md:pt-6 md:pb-6">
      {" "}
      <WhatHappening />
      {/* Profile Header */}
      <div className="mt-6 sm:mt-8 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-4 sm:gap-5">
          <AvatarUploader
            src={profile?.avatar}
            size={72}
            disabled={!isOwner}
            onUpload={handleAvatarUploaded}
            onRemove={() => setShowRemoveModal(true)}
          />

          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
              {profile?.name}
            </h1>

            <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
              {profile?.isPrivate ? (
                <>
                  <Lock size={13} />
                  <span>Private account</span>
                </>
              ) : (
                <>
                  <Globe size={13} />
                  <span>Public account</span>
                </>
              )}
            </div>

            <span className="block mt-1 text-sm sm:text-base text-gray-500 truncate">
              {profile?.email}
            </span>
          </div>

          {/* Followers and Following */}
          <div className="mt-5 flex items-center gap-6 text-sm">
            <p>
              <span className="font-bold text-gray-900">
                {followStats.followersCount}
              </span>{" "}
              <span className="text-gray-500">Followers</span>
            </p>

            <p>
              <span className="font-bold text-gray-900">
                {followStats.followingCount}
              </span>{" "}
              <span className="text-gray-500">Following</span>
            </p>
          </div>
        </div>
      </div>
      {/* Divider */}
      <div className="my-6 sm:my-8">
        <div className="flex items-center gap-3">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            Posts
          </h2>

          <div className="h-px flex-1 bg-gray-200" />
        </div>
      </div>
      {/* Posts */}
      <div className="space-y-4 sm:space-y-5">
        {[...(optimisticPosts || [])]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map((post) => (
            <article
              key={post._id}
              className="relative rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm transition hover:shadow-md"
            >
              {/* Post Header */}
              <div className="flex items-center gap-3 pr-10">
                <img
                  src={post?.user?.avatar || "/avatar.png"}
                  alt={post?.user?.name || "User"}
                  className="h-10 w-10 rounded-full object-cover"
                />

                <div className="min-w-0">
                  <h3 className="truncate text-sm sm:text-base font-semibold text-gray-900">
                    {post?.user?.name}
                  </h3>

                  <p className="text-xs sm:text-sm text-gray-400">
                    {new Date(post?.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Delete Button */}
              {isOwner && (
                <button
                  type="button"
                  className="absolute right-3 top-3 rounded-full p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                  onClick={() => setDeleteTarget(post._id)}
                  aria-label="Delete post"
                >
                  <Trash size={18} />
                </button>
              )}

              {/* Post Text */}
              {post?.text && (
                <div className="mt-4 text-sm sm:text-base leading-6 text-gray-800">
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

              {/* Like Button */}
              {/* Like and Comment Buttons */}
              <div className="mt-3 flex items-center gap-5 text-sm text-gray-500">
                {/* Like */}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    handleLike(
                      post._id,
                      Array.isArray(post?.likes) ? post.likes.length : 0,
                      !!post?.isLikedByUser,
                    )
                  }
                  className="flex items-center gap-2 disabled:opacity-50"
                >
                  <Heart
                    size={20}
                    className={
                      post?.isLikedByUser
                        ? "fill-red-500 text-red-500"
                        : "text-gray-500"
                    }
                  />

                  <span
                    className={
                      post?.isLikedByUser ? "text-red-500" : "text-gray-500"
                    }
                  >
                    {Array.isArray(post?.likes) ? post.likes.length : 0}
                  </span>
                </button>

                {/* Comments */}
                <button
                  type="button"
                  onClick={() => toggleComments(post._id)}
                  className="flex items-center gap-2 transition-colors hover:text-primary"
                >
                  <MessageCircle
                    size={20}
                    className={
                      showComments[post._id] ? "text-primary" : "text-gray-500"
                    }
                  />

                  <span
                    className={
                      showComments[post._id] ? "text-primary" : "text-gray-500"
                    }
                  >
                    {commentCounts[post._id] || 0}
                  </span>
                </button>

                {/* Save Post */}
                <button
                  type="button"
                  disabled={!!savingPosts[post._id]}
                  onClick={() => handleSavePost(post._id)}
                  className="flex items-center gap-2 transition-colors hover:text-[#2764de] disabled:opacity-50"
                  aria-label={post.isSavedByUser ? "Unsave post" : "Save post"}
                >
                  <Bookmark
                    size={20}
                    className={
                      post.isSavedByUser
                        ? "fill-[#2764de] text-[#2764de]"
                        : "text-gray-500"
                    }
                  />

                  <span
                    className={
                      post.isSavedByUser ? "text-[#2764de]" : "text-gray-500"
                    }
                  >
                    {post.isSavedByUser ? "Saved" : "Save"}
                  </span>
                </button>
              </div>

              <CommentsSection
                postId={post._id}
                showComments={showComments[post._id] || false}
                commentsCount={commentCounts[post._id] || 0}
                onCountChange={(count) => {
                  setCommentCounts((prev) => ({
                    ...prev,
                    [post._id]: count,
                  }));
                }}
              />
            </article>
          ))}
      </div>
      {/* Remove Avatar Modal */}
      {showRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Remove Avatar
            </h2>

            <p className="mt-2 text-sm sm:text-base leading-6 text-gray-500">
              Are you sure you want to remove your avatar?
            </p>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowRemoveModal(false)}
                className="w-full sm:w-auto rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={async () => {
                  setShowRemoveModal(false);
                  await handleRemoveAvatar();
                }}
                className="w-full sm:w-auto rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Post Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Post?
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete this post? This action cannot be
              undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
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

export default Profile;
