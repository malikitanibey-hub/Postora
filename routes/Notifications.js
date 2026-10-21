
import express from "express";
import { authMiddleware } from "../middleware/AuthMiddleware.js";
import Notification from "../models/notification.js";
import Follow from "../models/Follow.js";

const router = express.Router();

// Check whether the recipient can still view a notification's post.
async function canViewNotificationPost(viewerId, post) {
  // Notifications without a post, such as follow requests, are unaffected.
  if (!post) return true;

  const author = post.user;

// Hide post notifications if the author cannot be verified.
if (!author) return false;

  const authorId = author._id
    ? author._id.toString()
    : author.toString();

  // The author can always view their own post.
  if (authorId === viewerId.toString()) return true;

  // Public posts remain accessible.
  if (!author.isPrivate) return true;

  // Private posts require an accepted follow.
  const acceptedFollow = await Follow.exists({
    follower: viewerId,
    following: authorId,
    status: "accepted",
  });

  return Boolean(acceptedFollow);
}

// Populate notifications and filter out inaccessible private posts.
async function getVisibleNotifications(notifications, viewerId) {
  const results = await Promise.all(
    notifications.map(async (notification) => {
      const canView = await canViewNotificationPost(
        viewerId,
        notification.post,
      );

      return canView ? notification : null;
    }),
  );

  return results.filter(Boolean);
}

// Get all notifications.
router.get("/", authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.id,
    })
      .populate("sender", "name avatar")
      .populate({
        path: "post",
        select: "text user",
        populate: {
          path: "user",
          select: "isPrivate",
        },
      })
      .populate("comment", "text post parentComment")
      .sort({ createdAt: -1 });

    const visibleNotifications = await getVisibleNotifications(
      notifications,
      req.user.id,
    );

    return res.json(visibleNotifications);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get unread notification count, excluding inaccessible private posts.
router.get("/unread-count", authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.id,
      read: false,
    }).populate({
      path: "post",
      select: "user",
      populate: {
        path: "user",
        select: "isPrivate",
      },
    });

    const visibleNotifications = await getVisibleNotifications(
      notifications,
      req.user.id,
    );

    return res.json({ count: visibleNotifications.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Mark one notification as read.
router.patch("/:id/read", authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user.id,
      },
      { $set: { read: true } },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    return res.json(notification);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read.
router.patch("/read-all", authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipient: req.user.id,
        read: false,
      },
      { $set: { read: true } },
    );

    return res.json({
      message: "All notifications marked as seen",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
