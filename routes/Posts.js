import express from "express";
import Post from "../models/Posts.js";
import { authMiddleware } from "../middleware/AuthMiddleware.js";
import imagekit from "../utils/imagekit.js";
import multer from "multer";
import Notification from "../models/notification.js";
// import { userSockets } from "../server.js";
import User from "../models/User.js";
import Follow from "../models/Follow.js";
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

async function createMentionNotifications({ mentions, senderId, post, io }) {
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
        });

      if (io) {
        io.to(`user:${userId}`).emit("notification:new", populatedNotification);
      }
    }
  } catch (error) {
    console.error("Failed to create mention notifications:", error);
  }
}

async function getVisibleAuthorIds(userId) {
  const [visibleUsers, acceptedFollows] = await Promise.all([
    User.find({
      $or: [{ isPrivate: { $ne: true } }, { _id: userId }],
    }).select("_id"),

    Follow.find({
      follower: userId,
      status: "accepted",
    }).select("following"),
  ]);

  const ids = new Set([
    ...visibleUsers.map((user) => user._id.toString()),
    ...acceptedFollows.map((follow) => follow.following.toString()),
  ]);

  return [...ids];
}

async function canViewPost(viewerId, post) {
  const authorId = post.user?._id
    ? post.user._id.toString()
    : post.user?.toString();

  if (!authorId) return false;

  if (authorId === viewerId.toString()) {
    return true;
  }

  const author = await User.findById(authorId).select("isPrivate");

  if (!author) return false;

  if (!author.isPrivate) {
    return true;
  }

  const acceptedFollow = await Follow.exists({
    follower: viewerId,
    following: authorId,
    status: "accepted",
  });

  return Boolean(acceptedFollow);
}

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
    files: 1,
  },

  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");

    if (isImage || isVideo) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed."));
    }
  },
});

const parsePostUpload = (req, res, next) => {
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ])(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: "The maximum file size is 100 MB.",
        });
      }

      return res.status(400).json({
        error: error.message || "File upload failed.",
      });
    }

    next();
  });
};

// CREATE POST WITH IMAGE OR VIDEO
router.post("/", authMiddleware, parsePostUpload, async (req, res) => {
  try {
    const { text } = req.body;
    const mentions = parseMentions(req.body.mentions);

    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    if (imageFile && videoFile) {
      return res.status(400).json({
        error: "Please upload either an image or a video, not both.",
      });
    }

    let imageUrl = null;
    let videoUrl = null;
    let mediaType = null;

    const file = imageFile || videoFile;

    if (file) {
      const result = await imagekit.files.upload({
        file: file.buffer.toString("base64"),
        fileName: `post-${Date.now()}-${file.originalname}`,
        folder: "/posts",
      });

      if (videoFile) {
        videoUrl = result.url;
        mediaType = "video";
      } else {
        imageUrl = result.url;
        mediaType = "image";
      }
    }

    const newPost = new Post({
      user: req.user.id,
      text,
      mentions,
      image: imageUrl,
      video: videoUrl,
      mediaType,
    });

    await newPost.save();

    // Create mention notifications without failing post creation
    // if the notification system encounters an error.
    await createMentionNotifications({
      mentions: newPost.mentions,
      senderId: req.user.id,
      post: newPost,
      io: req.app.get("io"),
    });

    return res.status(201).json(newPost);
  } catch (error) {
    console.error("Create post error:", error);

    res.status(500).json({
      error: "Failed to create post.",
    });
  }
});

//GET

router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const visibleAuthorIds = await getVisibleAuthorIds(userId);

    const [posts, user] = await Promise.all([
      Post.find({
        user: { $in: visibleAuthorIds },
      })
        .populate("user", "name avatar")
        .populate("mentions.user", "name avatar")
        .sort({ createdAt: -1 }),

      User.findById(userId).select("savedPosts"),
    ]);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const savedPostIds = new Set(user.savedPosts.map((id) => id.toString()));

    const postsWithStatus = posts.map((post) => ({
      ...post.toObject(),
      isLikedByUser: post.likes.some((id) => id.toString() === userId),
      isSavedByUser: savedPostIds.has(post._id.toString()),
    }));

    return res.json(postsWithStatus);
  } catch (error) {
    console.error("Get posts error:", error);
    return res.status(500).json({
      error: error.message,
    });
  }
});

/* SEARCH POSTS */
router.get("/search", authMiddleware, async (req, res) => {
  try {
    const query = req.query.q?.trim().slice(0, 100);
    const escapedQuery = query?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (!query) {
      return res.json([]);
    }

    const userId = req.user.id;
    const visibleAuthorIds = await getVisibleAuthorIds(userId);
    const [posts, user] = await Promise.all([
      Post.find({
        user: { $in: visibleAuthorIds },
        text: { $regex: escapedQuery, $options: "i" },
      })
        .populate("user", "name avatar")
        .populate("mentions.user", "name avatar")
        .sort({ createdAt: -1 }),

      User.findById(userId).select("savedPosts"),
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const savedPostIds = new Set(
      (user.savedPosts || []).map((id) => id.toString()),
    );

    const postsWithStatus = posts.map((post) => ({
      ...post.toObject(),
      isLikedByUser: post.likes.some((id) => id.toString() === userId),
      isSavedByUser: savedPostIds.has(post._id.toString()),
    }));

    res.json(postsWithStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* GET SAVED POSTS */
router.get("/saved", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: "savedPosts",
      populate: {
        path: "user",
        select: "name avatar",
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const visibleAuthorIds = new Set(
      (await getVisibleAuthorIds(req.user.id)).map(String),
    );

    const posts = (user.savedPosts || [])
      .filter(Boolean)
      .filter((post) =>
        visibleAuthorIds.has(
          post.user?._id?.toString() || post.user?.toString(),
        ),
      )
      .reverse()
      .map((post) => ({
        ...post.toObject(),
        isLikedByUser: post.likes.some(
          (userId) => userId.toString() === req.user.id,
        ),
        isSavedByUser: true,
      }));

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* SAVE OR UNSAVE A POST */
router.post("/save/:postId", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const [user, post] = await Promise.all([
      User.findById(userId),
      Post.findById(postId),
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!(await canViewPost(userId, post))) {
      return res.status(403).json({
        error: "You cannot access this private post.",
      });
    }

    const alreadySaved = user.savedPosts.some((id) => id.toString() === postId);

    if (alreadySaved) {
      user.savedPosts.pull(postId);
    } else {
      user.savedPosts.addToSet(postId);
    }

    await user.save();

    res.json({
      postId,
      saved: !alreadySaved,
      message: alreadySaved ? "Post removed from saved posts" : "Post saved",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//PUT
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        error: "Post not found",
      });
    }
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({
        error: "Not Authorized",
      });
    }
    post.text = req.body.text || post.text;
    post.image = req.body.image || post.image;
    await post.save();
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//DELETE
router.delete("/:postId", authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({
        error: "Post not found",
      });
    }
    if (post.user.toString() !== req.user.id) {
      return res.status(403).json({
        error: "Not Authorized",
      });
    }

    await post.deleteOne();
    res.json({ message: "Post Deleted Successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET POSTS BY USER ID
router.get("/by-user/:userId", authMiddleware, async (req, res) => {
  try {
    const viewerId = req.user.id;
    const targetUser = await User.findById(req.params.userId).select(
      "isPrivate",
    );

    if (!targetUser) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    if (
      targetUser.isPrivate &&
      !(await canViewPost(viewerId, { user: targetUser._id }))
    ) {
      return res.json([]);
    }

    const posts = await Post.find({
      user: targetUser._id,
    })
      .populate("user", "name avatar")
      .populate("mentions.user", "name avatar")
      .sort({ createdAt: -1 });

    const postsWithLikeStatus = posts.map((post) => ({
      ...post.toObject(),
      isLikedByUser: post.likes.some(
        (id) => id.toString() === viewerId.toString(),
      ),
    }));

    return res.json(postsWithLikeStatus);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

//LIKE POST
router.post("/like/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!(await canViewPost(userId, post))) {
      return res.status(403).json({
        error: "You cannot interact with this private post.",
      });
    }

    const hasLiked = post.likes.some((user) => user.toString() === userId);

    if (hasLiked) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);

      // Notify the post owner, but not when liking your own post.
      if (post.user.toString() !== userId) {
        const notification = await Notification.create({
          recipient: post.user,
          sender: userId,
          type: "like",
          post: post._id,
        });

        // Populate the same fields used by the notifications page.
        const populatedNotification = await Notification.findById(
          notification._id,
        )
          .populate("sender", "name avatar")
          .populate("post", "text")
          .populate("comment", "text");

        // Send the notification immediately to the recipient.
        const io = req.app.get("io");

        if (io) {
          io.to(`user:${post.user.toString()}`).emit(
            "notification:new",
            populatedNotification,
          );
        }
      }
    }

    await post.save();

    res.json({
      id: post._id,
      liked: !hasLiked,
      likesCount: post.likes.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* SEARCH POSTS */
export async function searchPosts(query) {
  const res = await fetch(`${POSTS}/search?q=${encodeURIComponent(query)}`, {
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to search posts");
  }

  return data;
}

export default router;
