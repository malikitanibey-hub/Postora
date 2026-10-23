import React, {
  useCallback,
  useEffect,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../api/authContext/UserContext";
import { deletePost, getPostsByUser, toggleSavePost } from "../api/posts";
import {
  Heart,
  Trash,
  MessageCircle,
  Bookmark,
  UserPlus,
  UserCheck,
  Lock,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import WhatHappening from "../components/WhatHappening";
import { getUserProfile } from "../api/auth";
import CommentsSection from "../components/CommentsSection";
import { getCommentCount } from "../api/comments";
import ImageViewer from "../components/ImageViewer";
import {
  getFollowStatus,
  followUser,
  unfollowUser,
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  getMentionUsers
} from "../api/follows";
import { Link } from "react-router-dom";

function UserDetails() {
  const { id } = useParams();
  const { user } = useAuth();

  const [appearance, setAppearance] = useState(
    () => localStorage.getItem("postoraAppearance") || "light",
  );

  useEffect(() => {
    const syncAppearance = () => {
      setAppearance(localStorage.getItem("postoraAppearance") || "light");
    };
    window.addEventListener("postora-theme-change", syncAppearance);
    window.addEventListener("storage", syncAppearance);
    return () => {
      window.removeEventListener("postora-theme-change", syncAppearance);
      window.removeEventListener("storage", syncAppearance);
    };
  }, []);

  const isDarkTheme = appearance === "dark";
  const isCustomTheme = appearance === "custom";
  const panelClass = isDarkTheme
    ? "border-[#343843] bg-[#1b1e25] text-[#f3f4f6]"
    : isCustomTheme
      ? "border-[#ded8f4] bg-white text-[#292342]"
      : "border-gray-200 bg-white text-gray-900";
  const headingClass = isDarkTheme
    ? "text-[#f3f4f6]"
    : isCustomTheme
      ? "text-[#292342]"
      : "text-gray-900";
  const bodyClass = isDarkTheme
    ? "text-[#d1d5db]"
    : isCustomTheme
      ? "text-[#494365]"
      : "text-gray-800";
  const mutedClass = isDarkTheme
    ? "text-[#9ca3af]"
    : isCustomTheme
      ? "text-[#77718f]"
      : "text-gray-500";
  const borderClass = isDarkTheme
    ? "border-[#343843]"
    : isCustomTheme
      ? "border-[#ded8f4]"
      : "border-gray-200";
  const hoverClass = isDarkTheme
    ? "hover:bg-[#272b34]"
    : isCustomTheme
      ? "hover:bg-[#f0edfc]"
      : "hover:bg-gray-100";
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [expandedPosts, setExpandedPosts] = useState({});
  const [showComments, setShowComments] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [isPending, startTransition] = useTransition();
  const [savingPosts, setSavingPosts] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [followStatus, setFollowStatus] = useState({
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
    followsYou: false,
    requestPending: false,
    isPrivate: false,
  });
  const [pendingFollowRequest, setPendingFollowRequest] = useState(null);
  const [requestActionLoading, setRequestActionLoading] = useState(false);
  const [mentionUsers, setMentionUsers] = useState([]);

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
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const users = await getUserProfile(id);

        if (cancelled) return;

        setProfile(users);

        const myPosts = await getPostsByUser(id);

        if (cancelled) return;

        setPosts(myPosts);

        const counts = {};

        await Promise.all(
          myPosts.map(async (post) => {
            try {
              counts[post._id] = await getCommentCount(post._id);
            } catch (error) {
              console.error(
                "Failed to load comment count for post",
                error,
              );
            }
          }),
        );

        if (!cancelled) {
          setCommentCounts(counts);
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        toast.error("Failed to load profile.");
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [id]);

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
    await deletePost(postId);
    setPosts((prev) => prev.filter((p) => p._id !== postId));
    toast.success("Post Deleted Successfully");
  }, []);

  useEffect(() => {
    if (!id || !user) return;

    let cancelled = false;

    const loadFollowStatus = async () => {
      try {
        const data = await getFollowStatus(id);

        if (!cancelled) {
          setFollowStatus(data);

          const requestsData = await getFollowRequests();
          const requests = Array.isArray(requestsData)
            ? requestsData
            : requestsData?.requests || [];
          const incomingRequest = requests.find(
            (request) =>
              String(request.follower?._id) === String(id)
          );
          if (!cancelled) {
            setPendingFollowRequest(incomingRequest || null);
          }

          // Refresh the profile's access permission.
          const updatedProfile = await getUserProfile(id);

          if (!cancelled) {
            setProfile(updatedProfile);

            if (
              data.isFollowing ||
              updatedProfile.canViewPosts ||
              !updatedProfile.isPrivate
            ) {
              const myPosts = await getPostsByUser(id);

              if (!cancelled) {
                setPosts(myPosts);
              }
            } else {
              setPosts([]);
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error.message || "Failed to load follow status");
        }
      }
    };

    loadFollowStatus();

    return () => {
      cancelled = true;
    };
  }, [id, user]);


  const handleFollowToggle = async () => {
    if (followLoading || !profile) return;

    setFollowLoading(true);

    try {
      if (followStatus.isFollowing || followStatus.requestPending) {
        // Unfollow or cancel a pending request
        await unfollowUser(profile._id);

        toast.success(
          followStatus.requestPending
            ? "Follow request cancelled."
            : `You unfollowed ${profile.name}.`
        );
      } else {
        // Follow or send a private-account request
        await followUser(profile._id);

        toast.success(
          followStatus.isPrivate
            ? "Follow request sent."
            : `You are now following ${profile.name}.`
        );
      }

      // Refresh counts and the actual relationship status
      const updatedStatus = await getFollowStatus(profile._id);
      setFollowStatus(updatedStatus);
    } catch (error) {
      toast.error(error.message || "Failed to update follow status");
    } finally {
      setFollowLoading(false);
    }
  };

  const handleAcceptFollowRequest = async () => {
    if (!pendingFollowRequest || requestActionLoading) return;

    setRequestActionLoading(true);

    try {
      await acceptFollowRequest(pendingFollowRequest._id);
      setPendingFollowRequest(null);

      const updatedStatus = await getFollowStatus(id);
      setFollowStatus(updatedStatus);

      toast.success(`You accepted ${profile.name}'s follow request.`);
    } catch (error) {
      toast.error(error.message || "Failed to accept follow request.");
    } finally {
      setRequestActionLoading(false);
    }
  };

  const handleRejectFollowRequest = async () => {
    if (!pendingFollowRequest || requestActionLoading) return;

    setRequestActionLoading(true);

    try {
      await rejectFollowRequest(pendingFollowRequest._id);
      setPendingFollowRequest(null);

      toast.success(`You rejected ${profile.name}'s follow request.`);
    } catch (error) {
      toast.error(error.message || "Failed to reject follow request.");
    } finally {
      setRequestActionLoading(false);
    }
  };

  const handleMessageClick = () => {
    toast.info("Messaging will be available soon.");
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
                  className={`flex w-56 items-center gap-3 rounded-xl border ${borderClass} ${panelClass} p-3 text-left shadow-xl`}
                >
                  <img
                    src={person.avatar || "/avatar.png"}
                    alt={person.name || mentionText.slice(1)}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />

                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-semibold ${headingClass}`}>
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
          Loading profile...
        </span>
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

  const isOwner =
    user?.id === profile._id ||
    user?._id === profile._id;

  const isPrivateContentHidden =
    profile.isPrivate &&
    !profile.canViewPosts &&
    !isOwner;

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <WhatHappening />

      {/* Profile Header */}
      <section className={`mt-6 sm:mt-8 rounded-2xl border p-4 sm:p-6 shadow-sm ${panelClass}`}>
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-4 sm:gap-5">
            <img
              src={profile?.avatar || "/avatar.png"}
              alt={profile?.name || "User"}
              className="h-[72px] w-[72px] shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <h1 className={`truncate text-xl sm:text-2xl font-bold ${headingClass}`}>
                {profile?.name}
              </h1>
              <span className={`mt-1 block truncate text-sm sm:text-base ${mutedClass}`}>
                {profile?.email}
              </span>
              <p className={`mt-3 whitespace-pre-wrap break-words text-sm sm:text-base ${profile?.bio ? bodyClass : mutedClass}`}>
                {profile?.bio || "No bio yet."}
              </p>
              {profile?.isPrivate && (
                <span className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium ${mutedClass}`}>
                  <Lock size={14} />
                  Private account
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm">
            <p>
              <span className={`font-bold ${headingClass}`}>
                {profile?.postsCount ?? profile?.postCount ?? posts.length}
              </span>{" "}
              <span className={mutedClass}>Posts</span>
            </p>
            <p>
              <span className={`font-bold ${headingClass}`}>{followStatus.followersCount}</span>{" "}
              <span className={mutedClass}>Followers</span>
            </p>
            <p>
              <span className={`font-bold ${headingClass}`}>{followStatus.followingCount}</span>{" "}
              <span className={mutedClass}>Following</span>
            </p>
          </div>

          {user && !isOwner && (
            <div className="flex flex-wrap items-center gap-2">
              {pendingFollowRequest ? (
                <>
                  <button
                    type="button"
                    onClick={handleAcceptFollowRequest}
                    disabled={requestActionLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2764de] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UserCheck size={18} />
                    {requestActionLoading ? "Please wait..." : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectFollowRequest}
                    disabled={requestActionLoading}
                    className={`inline-flex items-center justify-center rounded-full border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${borderClass} ${hoverClass} ${bodyClass}`}
                  >
                    Reject
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    followStatus.isFollowing
                      ? `border ${borderClass} ${panelClass} ${hoverClass}`
                      : "bg-[#2764de] text-white hover:bg-blue-700"
                  }`}
                >
                  {followStatus.isFollowing ? <UserCheck size={18} /> : <UserPlus size={18} />}
                  {followLoading
                    ? "Please wait..."
                    : followStatus.isFollowing
                      ? "Following"
                      : followStatus.requestPending
                        ? "Requested · Cancel"
                        : followStatus.followsYou
                          ? "Follow back"
                          : "Follow"}
                </button>
              )}

              <button
                type="button"
                onClick={handleMessageClick}
                className={`inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${borderClass} ${bodyClass} ${hoverClass}`}
              >
                <Send size={17} />
                Message
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Divider */}
      <div className="my-6 sm:my-8">
        <div className="flex items-center gap-3">
          <h2 className={`text-lg sm:text-xl font-semibold ${headingClass}`}>
            Posts
          </h2>

          <div className={`h-px flex-1 ${isDarkTheme ? "bg-[#343843]" : isCustomTheme ? "bg-[#ded8f4]" : "bg-gray-200"}`} />
        </div>
      </div>

      {/* Posts */}
      {isPrivateContentHidden ? (
        <div className={`rounded-2xl border ${borderClass} ${panelClass} px-6 py-12 text-center shadow-sm`}>
          <Lock size={36} className="mx-auto text-gray-400" />

          <h3 className={`mt-4 text-lg font-semibold ${headingClass}`}>
            This account is private
          </h3>

          <p className={`mt-2 text-sm ${mutedClass}`}>
            Follow this account to see its posts. You'll get access
            after the owner accepts your request.
          </p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-5">


          {[...(optimisticPosts || [])]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((post) => (
              <article
                key={post._id}
                className={`relative rounded-2xl border ${borderClass} ${panelClass} p-4 sm:p-5 shadow-sm transition hover:shadow-md`}
              >
                {/* Post Header */}
                <div className="flex items-center gap-3 pr-10">
                  <img
                    src={post?.user?.avatar || "/avatar.png"}
                    alt={post?.user?.name || "User"}
                    className="h-10 w-10 rounded-full object-cover"
                  />

                  <div className="min-w-0">
                    <h3 className={`truncate text-sm sm:text-base font-semibold ${headingClass}`}>
                      {post?.user?.name}
                    </h3>

                    <p className={`text-xs sm:text-sm ${mutedClass}`}>
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
                    onClick={() => onDelete(post?._id)}
                    aria-label="Delete post"
                  >
                    <Trash size={18} />
                  </button>
                )}

                {/* Post Text */}
                {post?.text && (
                  <div className={`mt-4 text-sm sm:text-base leading-6 ${bodyClass}`}>
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

export default UserDetails;
