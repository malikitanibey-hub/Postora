
import React, { useEffect, useRef, useState } from "react";
import {
  addComment,
  getCommentsByPost,
  addReply,
  addNestedReply,
  deleteComment,
  deleteReply,
  toggleCommentLike,
  toggleReplyLike,
} from "../api/comments";
import { getMentionUsers } from "../api/follows";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useAuth } from "../api/authContext/UserContext";
import {
  Send,
  MoreHorizontal,
  Trash2,
  Smile,
  Heart,
  X,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import "../styles/comments.css";

// Recursively update a reply anywhere in the reply tree.
const updateReplyTree = (replies = [], replyId, updater) =>
  replies.map((reply) => {
    if (String(reply._id) === String(replyId)) {
      return updater(reply);
    }

    return {
      ...reply,
      replies: updateReplyTree(reply.replies || [], replyId, updater),
    };
  });

// Recursively remove a reply anywhere in the reply tree.
const removeReplyTree = (replies = [], replyId) =>
  replies
    .filter((reply) => String(reply._id) !== String(replyId))
    .map((reply) => ({
      ...reply,
      replies: removeReplyTree(reply.replies || [], replyId),
    }));

const getId = (value) => {
  if (!value) return "";
  return String(value._id || value.id || value);
};

// Count all replies, including nested replies.
const countReplies = (replies = []) =>
  replies.reduce(
    (total, reply) =>
      total + 1 + countReplies(reply.replies || []),
    0,
  );

// Count every comment and reply in a post.
const countAllComments = (comments = []) =>
  comments.reduce(
    (total, comment) =>
      total + 1 + countReplies(comment.replies || []),
    0,
  );

// Display relative dates, then switch to DD-MM-YYYY after 2 weeks.
const formatCommentDate = (dateValue) => {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds} sec`;
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours} hrs`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return `${elapsedDays} days`;
  }

  if (elapsedDays < 14) {
    return "1 week";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
};

const updateMentionPositions = (mentions = [], oldText, newText) => {
  let prefixLength = 0;

  while (
    prefixLength < oldText.length &&
    prefixLength < newText.length &&
    oldText[prefixLength] === newText[prefixLength]
  ) {
    prefixLength++;
  }

  let oldSuffix = oldText.length;
  let newSuffix = newText.length;

  while (
    oldSuffix > prefixLength &&
    newSuffix > prefixLength &&
    oldText[oldSuffix - 1] === newText[newSuffix - 1]
  ) {
    oldSuffix--;
    newSuffix--;
  }

  const difference = newSuffix - oldSuffix;

  return mentions
    .map((mention) => {
      if (mention.end <= prefixLength) {
        return mention;
      }

      if (mention.start >= oldSuffix) {
        return {
          ...mention,
          start: mention.start + difference,
          end: mention.end + difference,
        };
      }

      return null;
    })
    .filter(
      (mention) =>
        mention &&
        mention.start >= 0 &&
        mention.end <= newText.length &&
        newText.slice(mention.start, mention.end) === mention.text,
    );
};

function CommentsSection({
  postId,
  showComments,
  commentsCount,
  onCountChange,
  focusCommentId,
}) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [replyText, setReplyText] = useState({});
  const [showReplyInput, setShowReplyInput] = useState({});
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showCommentEmoji, setShowCommentEmoji] = useState(false);
  const [showReplyEmoji, setShowReplyEmoji] = useState({});
  const [expandedTexts, setExpandedTexts] = useState({});
  const [mentionUsers, setMentionUsers] = useState([]);
  const [mentionState, setMentionState] = useState(null);
  const [mentionUsersLoaded, setMentionUsersLoaded] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState({});
  const REPLIES_PER_PAGE = 3;
  const [selectedMentions, setSelectedMentions] = useState({
    comment: [],
  });

  const { user } = useAuth();
  const currentUserId = getId(user);
  const focusedCommentRef = useRef(null);

  const TEXT_LIMIT = 180;

  // Load comments.
  const loadComments = async () => {
    setLoadingComments(true);

    try {
      const data = await getCommentsByPost(postId);
      const loadedComments = Array.isArray(data) ? data : [];

      setComments(loadedComments);
      onCountChange?.(countAllComments(loadedComments));
      setCommentsLoaded(true);
    } catch (error) {
      toast.error("Failed to load comments");
      console.error(error);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (showComments && !commentsLoaded) {
      loadComments();
    }
  }, [showComments, commentsLoaded, postId]);

  // Load accepted followers and following for @mention suggestions.
  useEffect(() => {
    if (!showComments || mentionUsersLoaded) return;

    let cancelled = false;

    const loadMentionUsers = async () => {
      try {
        const data = await getMentionUsers();

        if (!cancelled) {
          setMentionUsers(Array.isArray(data) ? data : []);
          setMentionUsersLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load mention users:", error);
      }
    };

    loadMentionUsers();

    return () => {
      cancelled = true;
    };
  }, [showComments, mentionUsersLoaded]);

  useEffect(() => {
    if (
      !showComments ||
      !commentsLoaded ||
      !focusCommentId ||
      focusedCommentRef.current === focusCommentId
    ) {
      return;
    }

    const targetComment = comments.find(
      (comment) => String(comment._id) === String(focusCommentId),
    );

    if (!targetComment) return;

    focusedCommentRef.current = focusCommentId;

    requestAnimationFrame(() => {
      document.getElementById(`comment-${focusCommentId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [showComments, commentsLoaded, focusCommentId, comments]);

  // Add a comment.
  const handleAddComment = async () => {
    const rawText = commentText;
    const text = rawText.trim();

    if (!text) {
      toast.error("Comment cannot be empty");
      return;
    }

    const leadingSpaces = rawText.length - rawText.trimStart().length;

    const mentions = (selectedMentions.comment || [])
      .map((mention) => ({
        user: mention.user,
        start: mention.start - leadingSpaces,
        end: mention.end - leadingSpaces,
        text: mention.text,
      }))
      .filter(
        (mention) =>
          mention.start >= 0 &&
          mention.end <= text.length &&
          text.slice(mention.start, mention.end) === mention.text,
      )
      .map(({ user, start, end }) => ({ user, start, end }));

    try {
      const newComment = await addComment(postId, text, mentions);

      setComments((prev) => {
        const updatedComments = [newComment, ...prev];

        onCountChange?.(countAllComments(updatedComments));

        return updatedComments;
      });
      setCommentText("");
      setSelectedMentions((prev) => ({ ...prev, comment: [] }));
      setMentionState(null);

      toast.success("Comment added successfully");
    } catch (error) {
      toast.error(error.message || "Failed to add comment");
      console.error(error);
    }
  };

  // Add a direct reply to a comment or a nested reply.
  const handleAddReply = async (commentId, parentReplyId = null) => {
    const inputKey = parentReplyId
      ? `reply-${parentReplyId}`
      : `comment-${commentId}`;

    const rawText = replyText[inputKey] || "";
    const text = rawText.trim();

    if (!text) {
      toast.error("Reply cannot be empty");
      return;
    }

    const leadingSpaces = rawText.length - rawText.trimStart().length;

    const mentions = (selectedMentions[inputKey] || [])
      .map((mention) => ({
        user: mention.user,
        start: mention.start - leadingSpaces,
        end: mention.end - leadingSpaces,
        text: mention.text,
      }))
      .filter(
        (mention) =>
          mention.start >= 0 &&
          mention.end <= text.length &&
          text.slice(mention.start, mention.end) === mention.text,
      )
      .map(({ user, start, end }) => ({ user, start, end }));

    try {
      const updatedComment = parentReplyId
        ? await addNestedReply(commentId, parentReplyId, text, mentions)
        : await addReply(commentId, text, mentions);

      setComments((prev) => {
        const updatedComments = prev.map((comment) =>
          String(comment._id) === String(commentId)
            ? updatedComment
            : comment,
        );

        onCountChange?.(countAllComments(updatedComments));

        return updatedComments;
      });

      setReplyText((prev) => ({ ...prev, [inputKey]: "" }));
      setSelectedMentions((prev) => ({ ...prev, [inputKey]: [] }));
      setShowReplyInput((prev) => ({ ...prev, [inputKey]: false }));
      setShowReplyEmoji((prev) => ({ ...prev, [inputKey]: false }));
      setMentionState(null);

      toast.success("Reply added successfully");
    } catch (error) {
      toast.error(error.message || "Failed to add reply");
      console.error(error);
    }
  };

  // Open a reply input and automatically mention the person being replied to.
  const openReplyInput = (inputKey, targetUser) => {
    const isOpening = !showReplyInput[inputKey];
    const username = targetUser?.username;
    const targetId = getId(targetUser);

    if (isOpening && username && targetId) {
      const mentionText = `@${username}`;

      setReplyText((prev) => ({
        ...prev,
        [inputKey]: `${mentionText} `,
      }));

      setSelectedMentions((prev) => ({
        ...prev,
        [inputKey]: [
          {
            user: targetId,
            start: 0,
            end: mentionText.length,
            text: mentionText,
          },
        ],
      }));
    } else if (isOpening) {
      setReplyText((prev) => ({ ...prev, [inputKey]: "" }));
      setSelectedMentions((prev) => ({ ...prev, [inputKey]: [] }));
    }

    setShowReplyInput((prev) => ({
      ...prev,
      [inputKey]: isOpening,
    }));

    setMentionState(null);
  };

  // Detect @username as the user types.
  // Handle typing in either the main comment or a reply input.
  const handleMentionInputChange = (inputKey, value, cursorPosition) => {
    const previousText =
      inputKey === "comment" ? commentText : replyText[inputKey] || "";

    setSelectedMentions((prev) => ({
      ...prev,
      [inputKey]: updateMentionPositions(
        prev[inputKey] || [],
        previousText,
        value,
      ),
    }));

    if (inputKey === "comment") {
      setCommentText(value);
    } else {
      setReplyText((prev) => ({ ...prev, [inputKey]: value }));
    }

    const textBeforeCursor = value.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/(?:^|\s)@([^\s@]*)$/);

    if (match) {
      const atIndex =
        cursorPosition - match[0].length + match[0].indexOf("@");

      setMentionState({
        inputKey,
        query: match[1].toLowerCase(),
        start: atIndex,
        cursor: cursorPosition,
      });
    } else {
      setMentionState(null);
    }
  };

  // Insert the selected mention into a comment or reply.
  const selectMention = (inputKey, person) => {
    if (!mentionState || mentionState.inputKey !== inputKey) return;

    const userId = getId(person);
    if (!userId) return;

    const currentText =
      inputKey === "comment" ? commentText : replyText[inputKey] || "";

    const start = mentionState.start;
    const cursor = mentionState.cursor;
    const mentionText = `@${person.username}`;
    const insertedText = `${mentionText} `;

    const nextText =
      currentText.slice(0, start) +
      insertedText +
      currentText.slice(cursor);

    const difference = insertedText.length - (cursor - start);

    setSelectedMentions((prev) => {
      const existing = (prev[inputKey] || [])
        .filter(
          (mention) =>
            mention.end <= start || mention.start >= cursor,
        )
        .map((mention) =>
          mention.start >= cursor
            ? {
              ...mention,
              start: mention.start + difference,
              end: mention.end + difference,
            }
            : mention,
        );

      return {
        ...prev,
        [inputKey]: [
          ...existing,
          {
            user: userId,
            start,
            end: start + mentionText.length,
            text: mentionText,
          },
        ].sort((a, b) => a.start - b.start),
      };
    });

    if (inputKey === "comment") {
      setCommentText(nextText);
    } else {
      setReplyText((prev) => ({ ...prev, [inputKey]: nextText }));
    }

    setMentionState(null);
  };


  const getMentionMatches = () => {
    if (!mentionState) return [];

    return mentionUsers
.filter((person) => {
  if (!person?.username || getId(person) === currentUserId) return false;

  return person.username
    .toLowerCase()
    .includes(mentionState.query);
})
      .slice(0, 6);
  };

  // Render the @mention dropdown for the active reply input.
  const renderMentionSuggestions = (inputKey) => {
    if (mentionState?.inputKey !== inputKey) return null;

    const matches = getMentionMatches();

    return (
      <div className="absolute bottom-full left-0 z-50 mb-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
        {matches.length > 0 ? (
          matches.map((person) => (
            <button
              key={getId(person)}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectMention(inputKey, person)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-blue-50 dark:hover:bg-slate-800"
            >
              <img
                src={person.avatar || "/avatar.png"}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"
              />
              <span className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {person.username}
              </span>
            </button>
          ))
        ) : (
          <p className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            {mentionUsersLoaded
              ? "No matching followers or following"
              : "Loading people..."}
          </p>
        )}
      </div>
    );
  };

  // Like or unlike a comment.
  const handleToggleCommentLike = async (commentId) => {
    const comment = comments.find(
      (item) => String(item._id) === String(commentId),
    );

    if (!comment || !currentUserId) return;

    const previousLikes = comment.likes || [];
    const alreadyLiked = previousLikes.some(
      (id) => getId(id) === currentUserId,
    );

    const updatedLikes = alreadyLiked
      ? previousLikes.filter((id) => getId(id) !== currentUserId)
      : [...previousLikes, currentUserId];

    setComments((prev) =>
      prev.map((item) =>
        String(item._id) === String(commentId)
          ? { ...item, likes: updatedLikes }
          : item,
      ),
    );

    try {
      const result = await toggleCommentLike(commentId);

      setComments((prev) =>
        prev.map((item) =>
          String(item._id) === String(commentId)
            ? { ...item, likes: result.likes }
            : item,
        ),
      );
    } catch (error) {
      setComments((prev) =>
        prev.map((item) =>
          String(item._id) === String(commentId)
            ? { ...item, likes: previousLikes }
            : item,
        ),
      );

      toast.error(error.message || "Failed to like comment");
    }
  };

  // Like or unlike a reply at any nesting level.
  const handleToggleReplyLike = async (commentId, replyId) => {
    const comment = comments.find(
      (item) => String(item._id) === String(commentId),
    );

    const findReply = (replies = []) => {
      for (const reply of replies) {
        if (String(reply._id) === String(replyId)) return reply;

        const nested = findReply(reply.replies || []);
        if (nested) return nested;
      }

      return null;
    };

    const reply = findReply(comment?.replies || []);
    if (!reply || !currentUserId) return;

    const previousLikes = reply.likes || [];
    const alreadyLiked = previousLikes.some(
      (id) => getId(id) === currentUserId,
    );

    const updatedLikes = alreadyLiked
      ? previousLikes.filter((id) => getId(id) !== currentUserId)
      : [...previousLikes, currentUserId];

    const updateInComments = (replyLikes) => {
      setComments((prev) =>
        prev.map((item) =>
          String(item._id) === String(commentId)
            ? {
              ...item,
              replies: updateReplyTree(
                item.replies || [],
                replyId,
                (target) => ({ ...target, likes: replyLikes }),
              ),
            }
            : item,
        ),
      );
    };

    updateInComments(updatedLikes);

    try {
      const result = await toggleReplyLike(commentId, replyId);
      updateInComments(result.likes);
    } catch (error) {
      updateInComments(previousLikes);
      toast.error(error.message || "Failed to like reply");
    }
  };

  // Delete a comment.
  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment(commentId);

      setComments((prev) => {
        const updatedComments = prev.filter(
          (comment) => String(comment._id) !== String(commentId),
        );

        onCountChange?.(countAllComments(updatedComments));

        return updatedComments;
      });

      toast.success("Comment deleted successfully");
    } catch (error) {
      toast.error(error.message || "Failed to delete comment");
      console.error(error);
    }
  };

  // Delete a reply at any nesting level.
  const handleDeleteReply = async (commentId, replyId) => {
    try {
      await deleteReply(commentId, replyId);

      setComments((prev) => {
        const updatedComments = prev.map((comment) =>
          String(comment._id) === String(commentId)
            ? {
              ...comment,
              replies: removeReplyTree(comment.replies || [], replyId),
            }
            : comment,
        );

        onCountChange?.(countAllComments(updatedComments));

        return updatedComments;
      });

      toast.success("Reply deleted successfully");
    } catch (error) {
      toast.error(error.message || "Failed to delete reply");
      console.error(error);
    }
  };

  const openDeleteConfirmation = (type, commentId, replyId = null) => {
    setOpenMenu(null);
    setDeleteTarget({ type, commentId, replyId });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "comment") {
      await handleDeleteComment(deleteTarget.commentId);
    } else {
      await handleDeleteReply(
        deleteTarget.commentId,
        deleteTarget.replyId,
      );
    }

    setDeleteTarget(null);
  };

  const toggleExpandedText = (id) => {
    setExpandedTexts((prev) => ({ ...prev, [id]: !prev[id] }));
  };


  // Display recognized @mentions as bold profile links with a hover preview.
  const renderMentionText = (text, id, mentions = []) => {
    const validMentions = (mentions || [])
      .filter(
        (mention) =>
          mention &&
          Number.isInteger(mention.start) &&
          Number.isInteger(mention.end) &&
          mention.start >= 0 &&
          mention.end <= text.length &&
          mention.end > mention.start &&
          text.slice(mention.start, mention.end).startsWith("@"),
      )
      .sort((a, b) => a.start - b.start);

    if (!validMentions.length) return text;

    const parts = [];
    let lastIndex = 0;
    let index = 0;

    validMentions.forEach((mention) => {
      if (mention.start < lastIndex) return;

      if (mention.start > lastIndex) {
        parts.push(text.slice(lastIndex, mention.start));
      }

      const userId = getId(mention.user);
      const mentionText = text.slice(mention.start, mention.end);
      const person =
        mention.user && typeof mention.user === "object"
          ? mention.user
          : mentionUsers.find((item) => getId(item) === userId);

      if (!userId) {
        parts.push(mentionText);
      } else {
        parts.push(
          <span
            key={`${id}-mention-${index++}`}
            className="group/mention relative inline-block"
          >
            <Link
              to={`/userDetails/${userId}`}
              className="font-bold text-[#2764de] hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {mentionText}
            </Link>

            {person && (
              <span className="invisible absolute bottom-full left-0 z-50 mb-2 w-60 rounded-xl border border-gray-200 bg-white p-3 opacity-0 shadow-xl transition-all duration-150 group-hover/mention:visible group-hover/mention:opacity-100">
                <span className="flex items-center gap-3">
                  <img
                    src={person.avatar || "/avatar.png"}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />

                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-gray-900">
                      {person.username || mentionText.slice(1)}
                    </span>
                    <span className="block text-xs text-gray-500">
                      View profile
                    </span>
                  </span>
                </span>
              </span>
            )}
          </span>,
        );
      }

      lastIndex = mention.end;
    });

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  const renderExpandableText = (text, id, mentions = []) => {
    const content = text || "";
    const isLong = content.length > TEXT_LIMIT;
    const isExpanded = expandedTexts[id];

    const displayedText =
      isLong && !isExpanded
        ? `${content.slice(0, TEXT_LIMIT).trimEnd()}...`
        : content;

    return (
      <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-6 text-slate-700 dark:text-slate-200 sm:text-sm">
        {renderMentionText(displayedText, id, mentions)}

        {isLong && (
          <button
            type="button"
            onClick={() => toggleExpandedText(id)}
            className="ml-1 inline-flex font-semibold text-[#2764de] transition-colors hover:text-blue-700"
          >
            {isExpanded ? "Read less" : "Read more"}
          </button>
        )}
      </p>
    );
  };


  // Reusable input for replies to comments and replies.
  const renderReplyInput = (commentId, parentReplyId = null) => {
    const inputKey = parentReplyId
      ? `reply-${parentReplyId}`
      : `comment-${commentId}`;

    if (!showReplyInput[inputKey]) return null;

    return (
      <div className="relative mt-3 min-w-0">
        {renderMentionSuggestions(inputKey)}


        {showReplyEmoji[inputKey] && (
          <div className="absolute bottom-14 left-0 z-40 max-w-[calc(100vw-2rem)]">
            <div className="overflow-hidden rounded-xl shadow-xl">
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  setReplyText((prev) => ({
                    ...prev,
                    [inputKey]: (prev[inputKey] || "") + emojiData.emoji,
                  }));
                }}
                width={300}
                height={350}
              />

              <div className="flex justify-end border-t border-gray-200 bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setReplyText((prev) => {
                      const text = prev[inputKey] || "";
                      if (!text) return prev;

                      const segmenter = new Intl.Segmenter(undefined, {
                        granularity: "grapheme",
                      });

                      const characters = Array.from(
                        segmenter.segment(text),
                        (item) => item.segment
                      );

                      characters.pop();

                      return {
                        ...prev,
                        [inputKey]: characters.join(""),
                      };
                    });
                  }}
                  title="Remove last character"
                  aria-label="Remove last character from reply"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:bg-gray-100"
                >
                  <X size={17} />
                </button>
              </div>
            </div>
          </div>
        )}


        <div className="flex min-w-0 items-center gap-2">
          <input
            type="text"
            placeholder="Write a reply... Type @ to mention someone"
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#2764de] focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900 dark:focus:ring-blue-950 sm:px-4"
            value={replyText[inputKey] || ""}
            onChange={(event) =>
              handleMentionInputChange(
                inputKey,
                event.target.value,
                event.target.selectionStart ?? event.target.value.length,
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Escape") setMentionState(null);

              if (event.key === "Enter") {
                event.preventDefault();
                handleAddReply(commentId, parentReplyId);
              }
            }}
          />

          <button
            type="button"
            onClick={() =>
              setShowReplyEmoji((prev) => ({
                ...prev,
                [inputKey]: !prev[inputKey],
              }))
            }
            className={`shrink-0 rounded-full p-2.5 transition ${showReplyEmoji[inputKey]
              ? "bg-blue-50 text-[#2764de] bg-blue-50 dark:text-[#2764de]"
              : "text-slate-500 hover:bg-blue-50 hover:text-[#2764de] dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
          >
            <Smile size={20} />
          </button>

          <button
            type="button"
            onClick={() => handleAddReply(commentId, parentReplyId)}
            className="shrink-0 rounded-full bg-[#2764de] p-2.5 text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-950"
            aria-label="Send reply"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    );
  };

  // Flatten every reply into one vertical list. Nested reply relationships are
  // preserved in the data and reply handler, but visually all replies align
  // underneath the original comment, like Facebook's comment threads.
  const renderReplies = (replies, commentId) => {
    if (!replies?.length) return null;

    const flattenReplies = (items, result = []) => {
      items.forEach((item) => {
        result.push(item);
        flattenReplies(item.replies || [], result);
      });
      return result;
    };

    const allReplies = flattenReplies(replies);
    const isExpanded = Boolean(expandedReplies[commentId]);
    const replyCount = allReplies.length;
    const visibleCount =
      expandedReplies[commentId] ??
      REPLIES_PER_PAGE;
    const visibleReplies = allReplies.slice(0, visibleCount);
    const remainingReplies = allReplies.length - visibleReplies.length;



    return (
      <div className="mt-3 min-w-0">
        <div className="min-w-0 space-y-3 border-l-2 border-slate-200 pl-3 dark:border-slate-700 sm:pl-4">
          {visibleReplies.map((reply) => {
            const replyId = String(reply._id);
            const replyInputKey = `reply-${replyId}`;
            const replyUserId = getId(reply.user);
            const isOwner =
              currentUserId && currentUserId === replyUserId;

            return (
              <div
                key={replyId}
                className="flex min-w-0 items-start gap-2 sm:gap-3"
              >
                <Link
                  to={`/userDetails/${replyUserId}`}
                  className="shrink-0"
                >
                  <img
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-white dark:ring-slate-900 sm:h-9 sm:w-9"
                    src={reply.user?.avatar || "/avatar.png"}
                    alt=""
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="min-w-0 rounded-2xl rounded-tl-md bg-slate-50 px-3 py-2.5 dark:bg-slate-800/80 sm:px-4 sm:py-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-2">
                        <Link
                          to={`/userDetails/${replyUserId}`}
                          className="block min-w-0 break-words text-sm font-bold text-slate-900 transition hover:text-[#2764de] hover:underline dark:text-slate-100"
                        >
                          {reply.user?.name || "User"}
                        </Link>

                        <span className="mt-0.5 block break-words text-[10px] font-medium text-slate-400 sm:mt-0 sm:shrink-0 sm:text-[11px]">
                          {formatCommentDate(reply.createdAt)}
                        </span>
                      </div>

                      {isOwner && (
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenu((prev) =>
                                prev === replyInputKey
                                  ? null
                                  : replyInputKey,
                              )
                            }
                            className="rounded-full p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                            aria-label="Reply options"
                          >
                            <MoreHorizontal size={18} />
                          </button>

                          {openMenu === replyInputKey && (
                            <div className="absolute right-0 top-8 z-30 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                              <button
                                type="button"
                                onClick={() =>
                                  openDeleteConfirmation(
                                    "reply",
                                    commentId,
                                    reply._id,
                                  )
                                }
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/40"
                              >
                                <Trash2 size={15} />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-1 flex min-w-0 items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {renderExpandableText(
                          reply.text,
                          `reply-${commentId}-${replyId}`,
                          reply.mentions || [],
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleToggleReplyLike(commentId, reply._id)
                        }
                        className="mt-1 flex shrink-0 flex-col items-center gap-1 rounded-xl px-1.5 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-700"
                        aria-label="Like reply"
                      >
                        <Heart
                          size={16}
                          className={(reply.likes || []).some(
                            (id) => getId(id) === currentUserId,
                          )
                            ? "fill-red-500 text-red-500"
                            : "text-gray-500"}
                        />

                        <span className="text-[11px] font-medium tabular-nums text-slate-400">
                          {reply.likes?.length || 0}
                        </span>
                      </button>
                    </div>

                    <button
                      type="button"
                      className="mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold text-[#2764de] transition hover:bg-blue-50 dark:hover:bg-slate-700 sm:text-sm"
                      onClick={() =>
                        openReplyInput(replyInputKey, reply.user)
                      }
                    >
                      Reply
                    </button>
                  </div>

                  {renderReplyInput(commentId, reply._id)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 ml-3 flex flex-wrap items-center gap-2 sm:ml-4">
          {remainingReplies > 0 && (
            <button
              type="button"
              onClick={() =>
                setExpandedReplies((prev) => ({
                  ...prev,
                  [commentId]: visibleCount + REPLIES_PER_PAGE,
                }))
              }
              className="rounded-full px-3 py-2 text-sm font-bold text-[#2764de] transition hover:bg-blue-50 dark:hover:bg-slate-800"
            >
              View {remainingReplies} more
            </button>
          )}

          {visibleReplies.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setExpandedReplies((prev) => ({
                  ...prev,
                  [commentId]: 0,
                }))
              }
              className="rounded-full px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Hide replies
            </button>
          )}

          {visibleCount === 0 && allReplies.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setExpandedReplies((prev) => ({
                  ...prev,
                  [commentId]: REPLIES_PER_PAGE,
                }))
              }
              className="rounded-full px-3 py-2 text-sm font-bold text-[#2764de] transition hover:bg-blue-50 dark:hover:bg-slate-800"
            >
              View replies
            </button>
          )}
        </div>
      </div>
    );


  };

  return (
    <>
      {showComments && (
        <div className="comments-section mt-4 space-y-5 sm:mt-5 sm:space-y-6">
          {/* Add comment */}
          <div className="relative">
            {renderMentionSuggestions("comment")}

            {showCommentEmoji && (
              <div className="absolute bottom-14 left-0 z-40">
                <div className="overflow-hidden rounded-xl shadow-xl">
                  <EmojiPicker
                    onEmojiClick={(emojiData) =>
                      setCommentText((prev) => prev + emojiData.emoji)
                    }
                    width={300}
                    height={350}
                  />

                  <div className="flex justify-end border-t border-gray-200 bg-white px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCommentText((previous) => {
                          if (!previous) return previous;

                          const segmenter = new Intl.Segmenter(undefined, {
                            granularity: "grapheme",
                          });

                          const characters = Array.from(
                            segmenter.segment(previous),
                            (item) => item.segment
                          );

                          characters.pop();
                          return characters.join("");
                        });
                      }}
                      title="Remove last character"
                      aria-label="Remove last character from comment"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:bg-gray-100"
                    >
                      <X size={17} />
                    </button>
                  </div>
                </div>
              </div>
            )}


            <div className="flex min-w-0 items-center gap-2">

              <input
                type="text"
                placeholder="Add a comment... Type @ to mention someone"
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#2764de] focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900 dark:focus:ring-blue-950 sm:px-4"
                value={commentText}
                onChange={(event) =>
                  handleMentionInputChange(
                    "comment",
                    event.target.value,
                    event.target.selectionStart ?? event.target.value.length,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setMentionState(null);
                  }

                  if (event.key === "Enter") {
                    if (mentionState?.inputKey === "comment") {
                      const firstMatch = getMentionMatches()[0];

                      if (firstMatch) {
                        event.preventDefault();
                        selectMention("comment", firstMatch);
                        return;
                      }
                    }

                    handleAddComment();
                  }
                }}
              />


              <button
                type="button"
                onClick={() => setShowCommentEmoji((prev) => !prev)}
                className={`shrink-0 rounded-full p-2.5 transition ${showCommentEmoji
                  ? "bg-blue-50 text-[#2764de] bg-blue-50 dark:text-[#2764de]"
                  : "text-slate-500 hover:bg-blue-50 hover:text-[#2764de] dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                aria-label="Add emoji to comment"
              >
                <Smile size={20} />
              </button>

              <button
                type="button"
                onClick={handleAddComment}
                className="shrink-0 rounded-full bg-[#2764de] p-2.5 text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-950 sm:px-3.5"
                aria-label="Send comment"
              >
                <Send size={20} />
              </button>
            </div>
          </div>



          {loadingComments ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {comments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-700"><div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-[#2764de] dark:bg-blue-950/50"><span className="text-xl">💬</span></div><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No comments yet</p><p className="mt-1 text-xs text-slate-400">Start the conversation.</p></div>
              ) : (
                comments.map((comment) => {
                  const commentUserId = getId(comment.user);
                  const isOwner =
                    currentUserId && currentUserId === commentUserId;
                  const commentInputKey = `comment-${comment._id}`;

                  return (
                    <div
                      key={comment._id}
                      id={`comment-${comment._id}`}
                      className={`rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900 sm:p-4 ${String(comment._id) === String(focusCommentId)
                        ? "ring-2 ring-[#2764de]"
                        : ""
                        }`}
                    >
                      <div className="flex gap-2">
                        <Link to={`/userDetails/${commentUserId}`}>
                          <img
                            className="h-9 w-9 shrink-0 cursor-pointer rounded-full object-cover ring-2 ring-white dark:ring-slate-800 sm:h-10 sm:w-10"
                            src={comment.user?.avatar || "/avatar.png"}
                            alt=""
                          />
                        </Link>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <Link
                              to={`/userDetails/${commentUserId}`}
                              className="min-w-0 truncate text-sm font-bold text-slate-900 transition hover:text-[#2764de] hover:underline dark:text-slate-100"
                            >
                              {comment.user?.name || "User"}
                            </Link>

                            <span className="text-[11px] text-slate-400 sm:text-xs">
                              {formatCommentDate(comment.createdAt)}
                            </span>

                            {isOwner && (
                              <div className="relative ml-auto">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenMenu((prev) =>
                                      prev === `comment-${comment._id}`
                                        ? null
                                        : `comment-${comment._id}`,
                                    )
                                  }
                                  className="rounded-full p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                                  aria-label="Comment options"
                                >
                                  <MoreHorizontal size={18} />
                                </button>

                                {openMenu === `comment-${comment._id}` && (
                                  <div className="absolute right-0 top-8 z-30 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openDeleteConfirmation(
                                          "comment",
                                          comment._id,
                                        )
                                      }
                                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/40"
                                    >
                                      <Trash2 size={15} />
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}


                          </div>

                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              {renderExpandableText(
                                comment.text,
                                `comment-${comment._id}`,
                                comment.mentions || [],
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleCommentLike(comment._id)
                              }
                              className="mt-1 flex shrink-0 flex-col items-center gap-1 rounded-xl px-1.5 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-700"
                              aria-label="Like comment"
                            >
                              <Heart
                                size={17}
                                className={(comment.likes || []).some(
                                  (id) => getId(id) === currentUserId,
                                )
                                  ? "fill-red-500 text-red-500"
                                  : "text-gray-500"}
                              />
                              <span className="text-[11px] font-medium tabular-nums text-slate-400">
                                {comment.likes?.length || 0}
                              </span>
                            </button>
                          </div>

                          <button
                            type="button"
                            className="mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold text-[#2764de] transition hover:bg-blue-50 dark:hover:bg-slate-800 sm:text-sm"
                            onClick={() =>
                              openReplyInput(
                                commentInputKey,
                                comment.user,
                              )
                            }
                          >
                            Reply
                          </button>

                          {renderReplyInput(comment._id)}

                          {renderReplies(
                            comment.replies || [],
                            comment._id,
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Delete confirmation */}
          {deleteTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Delete {deleteTarget.type === "comment" ? "Comment" : "Reply"}?
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Are you sure you want to delete this{" "}
                  {deleteTarget.type === "comment" ? "comment" : "reply"}? This
                  action cannot be undone.
                </p>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default CommentsSection;
