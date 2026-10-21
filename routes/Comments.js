import express from "express";
import Comments from "../models/Comments.js";
import { authMiddleware } from "../middleware/AuthMiddleware.js";
import Posts from "../models/Posts.js";
import User from "../models/User.js";
import Follow from "../models/Follow.js";
import Notification from "../models/notification.js";
// import { userSockets } from "../server.js";
import mongoose from "mongoose";

const router = express.Router();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseMentions(value) {
  try {
    const mentions = typeof value === "string" ? JSON.parse(value) : value;

    if (!Array.isArray(mentions)) return [];

    return mentions
      .filter(
        (mention) =>
          mention &&
          mongoose.isValidObjectId(mention.user) &&
          Number.isInteger(mention.start) &&
          Number.isInteger(mention.end) &&
          mention.start >= 0 &&
          mention.end > mention.start,
      )
      .map((mention) => ({
        user: mention.user,
        start: mention.start,
        end: mention.end,
      }));
  } catch {
    return [];
  }
}

async function createMentionNotifications({
  mentions,
  senderId,
  post,
  comment,
  io,
}) {
  if (!Array.isArray(mentions) || mentions.length === 0) return;

  try {
    const uniqueUserIds = [
      ...new Set(
        mentions
          .map((mention) => mention.user.toString())
          .filter((id) => id !== senderId.toString()),
      ),
    ];

    for (const userId of uniqueUserIds) {
      const exists = await User.exists({ _id: userId });
      if (!exists) continue;

      const notification = await Notification.create({
        recipient: userId,
        sender: senderId,
        type: "mention",
        post: post._id,
        comment: comment._id,
      });

      const populatedNotification = await Notification.findById(
        notification._id,
      )
        .populate("sender", "name avatar")
        .populate({
          path: "post",
          select: "text user",
          populate: {
            path: "user",
            select: "isPrivate",
          },
        })
        .populate("comment", "text");

      if (io) {
        io.to(`user:${userId}`).emit(
          "notification:new",
          populatedNotification,
        );
      }
    }
  } catch (error) {
    console.error("Failed to create mention notifications:", error);
  }
}

// Check whether the current user can access a post.
async function canViewPost(viewerId, post) {
  if (!post) return false;

  const authorId = post.user.toString();

  // The post owner can always access their own post.
  if (authorId === viewerId.toString()) return true;

  const author = await User.findById(authorId).select("isPrivate");

  if (!author) return false;

  // Public accounts' posts are visible.
  if (!author.isPrivate) return true;

  // Private accounts' posts require an accepted follow.
  const acceptedFollow = await Follow.exists({
    follower: viewerId,
    following: authorId,
    status: "accepted",
  });

  return Boolean(acceptedFollow);
}

function findReplyInTree(replies, replyId) {
  for (const reply of replies || []) {
    if (reply._id.toString() === replyId.toString()) {
      return reply;
    }

    const found = findReplyInTree(reply.replies, replyId);

    if (found) return found;
  }

  return null;
}

function removeReplyFromTree(replies, replyId) {
  const index = replies.findIndex(
    (reply) => reply._id.toString() === replyId.toString(),
  );

  if (index !== -1) {
    replies.splice(index, 1);
    return true;
  }

  for (const reply of replies) {
    if (removeReplyFromTree(reply.replies || [], replyId)) {
      return true;
    }
  }

  return false;
}

// Add a comment to a post.
router.post("/:postId", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const mentions = parseMentions(req.body.mentions);

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const post = await Posts.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!(await canViewPost(req.user.id, post))) {
      return res.status(403).json({
        error: "You cannot comment on this private post.",
      });
    }

const comment = new Comments({
  text: text.trim(),
  mentions,
  user: req.user.id,
  post: post._id,
});

    await comment.save();

    // Populate the comment author.
    await comment.populate("user", "name avatar");

await createMentionNotifications({
  mentions: comment.mentions,
  senderId: req.user.id,
  post,
  comment,
  io: req.app.get("io"),
});

    // Notify the post owner if someone else commented.
    if (post.user.toString() !== req.user.id.toString()) {
      const notification = new Notification({
        recipient: post.user,
        sender: req.user.id,
        type: "comment",
        post: post._id,
        comment: comment._id,
      });

      await notification.save();

      const populatedNotification = await Notification.findById(
        notification._id,
      )
        .populate("sender", "name avatar")
        .populate("post", "text")
        .populate("comment", "text");

      const io = req.app.get("io");

      if (io) {
        io.to(`user:${post.user.toString()}`).emit(
          "notification:new",
          populatedNotification,
        );
      }
    }

    return res.status(201).json(comment);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get all comments for a post.
router.get("/:postId", authMiddleware, async (req, res) => {
  try {
    const post = await Posts.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!(await canViewPost(req.user.id, post))) {
      return res.status(403).json({
        error: "You cannot view comments on this private post.",
      });
    }

const comments = await Comments.find({ post: post._id })
  .populate("user", "name avatar")
  .populate("mentions.user", "name avatar")
  .populate("replies.user", "name avatar")
  .populate("replies.mentions.user", "name avatar")
  .populate("replies.replies.user", "name avatar")
  .populate("replies.replies.mentions.user", "name avatar")
  .populate("replies.replies.replies.user", "name avatar")
  .populate("replies.replies.replies.mentions.user", "name avatar")
  .sort({ createdAt: -1 });

    return res.json(comments);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Reply to a comment.
router.post("/reply/:commentId", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const mentions = parseMentions(req.body.mentions);

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Reply text is required" });
    }

    const comment = await Comments.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const post = await Posts.findById(comment.post);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!(await canViewPost(req.user.id, post))) {
      return res.status(403).json({
        error: "You cannot reply to comments on this private post.",
      });
    }

    const commentOwnerId = comment.user.toString();

comment.replies.push({
  user: req.user.id,
  text: text.trim(),
  mentions,
});

    await comment.save();

const addedReply = comment.replies[comment.replies.length - 1];

await createMentionNotifications({
  mentions: addedReply.mentions,
  senderId: req.user.id,
  post,
  comment,
  io: req.app.get("io"),
});

    // Notify the comment owner if someone else replied.
    if (commentOwnerId !== req.user.id.toString()) {
      const notification = new Notification({
        recipient: commentOwnerId,
        sender: req.user.id,
        type: "reply",
        post: post._id,
        comment: comment._id,
      });

      await notification.save();

      const populatedNotification = await Notification.findById(
        notification._id,
      )
        .populate("sender", "name avatar")
        .populate("post", "text")
        .populate("comment", "text");

      const io = req.app.get("io");

      if (io) {
        io.to(`user:${commentOwnerId}`).emit(
          "notification:new",
          populatedNotification,
        );
      }
    }

    await comment.populate("user", "name avatar");
    await comment.populate("replies.user", "name avatar");

    return res.json(comment);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post(
  "/reply/:commentId/:parentReplyId",
  authMiddleware,
  async (req, res) => {
    try {
      const { text } = req.body;
      const mentions = parseMentions(req.body.mentions);

      if (typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Reply text is required" });
      }

      const comment = await Comments.findById(req.params.commentId);

      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      const post = await Posts.findById(comment.post);

      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      if (!(await canViewPost(req.user.id, post))) {
        return res.status(403).json({
          error: "You cannot reply to comments on this private post.",
        });
      }

      const parentReply = findReplyInTree(
        comment.replies,
        req.params.parentReplyId,
      );

      if (!parentReply) {
        return res.status(404).json({ error: "Parent reply not found" });
      }

      const parentOwnerId = parentReply.user._id
        ? parentReply.user._id.toString()
        : parentReply.user.toString();

parentReply.replies.push({
  user: req.user.id,
  text: text.trim(),
  mentions,
});

      await comment.save();

const addedReply =
  parentReply.replies[parentReply.replies.length - 1];

await createMentionNotifications({
  mentions: addedReply.mentions,
  senderId: req.user.id,
  post,
  comment,
  io: req.app.get("io"),
});

      if (parentOwnerId !== req.user.id.toString()) {
        const notification = await Notification.create({
          recipient: parentOwnerId,
          sender: req.user.id,
          type: "reply",
          post: post._id,
          comment: comment._id,
        });

        const populatedNotification = await Notification.findById(
          notification._id,
        )
          .populate("sender", "name avatar")
          .populate("post", "text")
          .populate("comment", "text");

        const io = req.app.get("io");

        if (io) {
          io.to(`user:${parentOwnerId}`).emit(
            "notification:new",
            populatedNotification,
          );
        }
      }

      await comment.populate("user", "name avatar");
      await comment.populate("replies.user", "name avatar");

      return res.status(201).json(comment);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
);

// Like or unlike a comment.
router.post("/:commentId/like", authMiddleware, async (req, res) => {
  try {
    const comment = await Comments.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const post = await Posts.findById(comment.post);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!(await canViewPost(req.user.id, post))) {
      return res.status(403).json({
        error: "You cannot access this private post.",
      });
    }

    const userId = req.user.id.toString();
    const ownerId = comment.user.toString();
    const alreadyLiked = comment.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      comment.likes.pull(req.user.id);
    } else {
      comment.likes.addToSet(req.user.id);
    }

    await comment.save();

    // Notify the comment owner only when another user likes it.
    if (!alreadyLiked && ownerId !== userId) {
      const notification = await Notification.create({
        recipient: comment.user,
        sender: req.user.id,
        type: "comment_like",
        post: post._id,
        comment: comment._id,
      });

      const populatedNotification = await Notification.findById(
        notification._id,
      )
        .populate("sender", "name avatar")
        .populate("post", "text")
        .populate("comment", "text");

      const io = req.app.get("io");

      if (io) {
        io.to(`user:${ownerId}`).emit(
          "notification:new",
          populatedNotification,
        );
      }
    }

    return res.json({
      liked: !alreadyLiked,
      likes: comment.likes,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Like or unlike a reply.
router.post(
  "/:commentId/reply/:replyId/like",
  authMiddleware,
  async (req, res) => {
    try {
      const comment = await Comments.findById(req.params.commentId);

      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      const reply = findReplyInTree(comment.replies, req.params.replyId);

      if (!reply) {
        return res.status(404).json({ error: "Reply not found" });
      }

      const post = await Posts.findById(comment.post);

      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      if (!(await canViewPost(req.user.id, post))) {
        return res.status(403).json({
          error: "You cannot access this private post.",
        });
      }

      const userId = req.user.id.toString();
      const ownerId = reply.user.toString();
      const alreadyLiked = reply.likes.some((id) => id.toString() === userId);

      if (alreadyLiked) {
        reply.likes.pull(req.user.id);
      } else {
        reply.likes.addToSet(req.user.id);
      }

      await comment.save();

      // Notify the reply owner only when another user likes it.
      if (!alreadyLiked && ownerId !== userId) {
        const notification = await Notification.create({
          recipient: reply.user,
          sender: req.user.id,
          type: "reply_like",
          post: post._id,
          comment: comment._id,
        });

        const populatedNotification = await Notification.findById(
          notification._id,
        )
          .populate("sender", "name avatar")
          .populate("post", "text")
          .populate("comment", "text");

        const io = req.app.get("io");

        if (io) {
          io.to(`user:${ownerId}`).emit(
            "notification:new",
            populatedNotification,
          );
        }
      }

      return res.json({
        liked: !alreadyLiked,
        likes: reply.likes,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
);

// Get the total comment count for a post, including all nested replies.
router.get("/count/:postId", authMiddleware, async (req, res) => {
  try {
    const post = await Posts.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!(await canViewPost(req.user.id, post))) {
      return res.status(403).json({
        error: "You cannot view this private post.",
      });
    }

    // Fetch top-level comments and their nested replies.
    const comments = await Comments.find({ post: post._id })
      .select("replies")
      .lean();

    // Count every reply recursively.
    const countReplies = (replies = []) => {
      return replies.reduce((total, reply) => {
        return (
          total +
          1 +
          countReplies(reply.replies || [])
        );
      }, 0);
    };

    // Count each top-level comment and all its replies.
    const count = comments.reduce((total, comment) => {
      return total + 1 + countReplies(comment.replies || []);
    }, 0);

    return res.json({ count });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete a comment.
router.delete("/:commentId", authMiddleware, async (req, res) => {
  try {
    const comment = await Comments.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (comment.user.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        error: "You can only delete your own comment",
      });
    }

    const post = await Posts.findById(comment.post);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!(await canViewPost(req.user.id, post))) {
      return res.status(403).json({
        error: "You cannot access this private post.",
      });
    }

    await comment.deleteOne();

    return res.json({
      message: "Comment deleted successfully",
      commentId: req.params.commentId,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete a reply.
router.delete(
  "/:commentId/reply/:replyId",
  authMiddleware,
  async (req, res) => {
    try {
      const comment = await Comments.findById(req.params.commentId);

      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      const reply = findReplyInTree(comment.replies, req.params.replyId);

      if (!reply) {
        return res.status(404).json({ error: "Reply not found" });
      }

      if (reply.user.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          error: "You can only delete your own reply",
        });
      }

      const post = await Posts.findById(comment.post);

      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      if (!(await canViewPost(req.user.id, post))) {
        return res.status(403).json({
          error: "You cannot access this private post.",
        });
      }

      removeReplyFromTree(comment.replies, req.params.replyId);
      await comment.save();

      return res.json({
        message: "Reply deleted successfully",
        commentId: comment._id,
        replyId: req.params.replyId,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
);

export default router;
