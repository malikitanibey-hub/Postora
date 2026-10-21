import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Follow from "../models/Follow.js";
import { authMiddleware } from "../middleware/AuthMiddleware.js";
import Notification from "../models/notification.js";
import { userSockets } from "../server.js";

const router = express.Router();

// Create and send a real-time follow-request notification.
async function sendFollowRequestNotification(req, followerId, followingId) {
  const notification = await Notification.create({
    recipient: followingId,
    sender: followerId,
    type: "follow_request",
  });

  const populatedNotification = await Notification.findById(
    notification._id,
  ).populate("sender", "name avatar");

const io = req.app.get("io");

if (io) {
  io.to(`user:${followingId.toString()}`).emit(
    "notification:new",
    populatedNotification
  );
}

  return notification;
}

// Remove the notification associated with a follow request.
async function removeFollowRequestNotification(followerId, followingId) {
  await Notification.deleteMany({
    recipient: followingId,
    sender: followerId,
    type: "follow_request",
  });
}

// Send a follow or follow request
router.post("/:id/follow", authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    if (followerId === followingId) {
      return res.status(400).json({
        message: "You cannot follow yourself.",
      });
    }

    if (!mongoose.isValidObjectId(followingId)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    const targetUser = await User.findById(followingId);

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const existingFollow = await Follow.findOne({
      follower: followerId,
      following: followingId,
    });

    if (existingFollow) {
      return res.status(400).json({
        message:
          existingFollow.status === "pending"
            ? "You have already requested to follow this user."
            : "You already follow this user.",
        status: existingFollow.status,
      });
    }

    const status = targetUser.isPrivate ? "pending" : "accepted";

    const follow = await Follow.create({
      follower: followerId,
      following: followingId,
      status,
    });

if (status === "pending") {
  // Private account: notify the owner about the follow request.
  await sendFollowRequestNotification(req, followerId, followingId);
} else {
  // Public account: notify the owner about the new follower.
  const notification = await Notification.create({
    recipient: followingId,
    sender: followerId,
    type: "new_follower",
  });

  const populatedNotification = await Notification.findById(
    notification._id
  ).populate("sender", "name avatar");

  const io = req.app.get("io");

  if (io) {
    io.to(`user:${followingId.toString()}`).emit(
      "notification:new",
      populatedNotification
    );
  }
}

    return res.status(201).json({
      message:
        status === "pending"
          ? "Follow request sent successfully."
          : "User followed successfully.",
      status,
      follow,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "A follow relationship or request already exists.",
      });
    }

    console.error("Follow user error:", error);

    return res.status(500).json({
      message: "Failed to follow user.",
    });
  }
});

// Unfollow or cancel a pending request
router.delete("/:id/follow", authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    const follow = await Follow.findOneAndDelete({
      follower: followerId,
      following: followingId,
    });

    if (!follow) {
      return res.status(404).json({
        message: "Follow relationship or request not found.",
      });
    }

    if (follow.status === "pending") {
      await removeFollowRequestNotification(followerId, followingId);
    }

    return res.status(200).json({
      message:
        follow.status === "pending"
          ? "Follow request cancelled."
          : "User unfollowed successfully.",
    });
  } catch (error) {
    console.error("Unfollow user error:", error);

    return res.status(500).json({
      message: "Failed to unfollow user.",
    });
  }
});

// Get the current user's incoming pending requests
router.get("/follow-requests", authMiddleware, async (req, res) => {
  try {
    const requests = await Follow.find({
      following: req.user.id,
      status: "pending",
    })
      .populate("follower", "name avatar")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      requests,
      count: requests.length,
    });
  } catch (error) {
    console.error("Get follow requests error:", error);

    return res.status(500).json({
      message: "Failed to get follow requests.",
    });
  }
});

// Accept an incoming follow request
router.patch(
  "/follow-requests/:requestId/accept",
  authMiddleware,
  async (req, res) => {
    try {
      const { requestId } = req.params;

      if (!mongoose.isValidObjectId(requestId)) {
        return res.status(400).json({
          message: "Invalid request ID.",
        });
      }

      const request = await Follow.findOne({
        _id: requestId,
        following: req.user.id,
        status: "pending",
      });

      if (!request) {
        return res.status(404).json({
          message: "Pending follow request not found.",
        });
      }

      request.status = "accepted";
      await request.save();

      // Remove the original follow-request notification.
      await removeFollowRequestNotification(
        request.follower,
        request.following,
      );

      // Notify the person whose request was accepted.
      const acceptedNotification = await Notification.create({
        recipient: request.follower,
        sender: request.following,
        type: "follow_accepted",
      });

      // Include the sender's profile information.
      const populatedNotification = await Notification.findById(
        acceptedNotification._id,
      ).populate("sender", "name avatar");

      // Send the notification immediately if the user is connected.
const io = req.app.get("io");

if (io) {
  io.to(`user:${request.follower.toString()}`).emit(
    "notification:new",
    populatedNotification
  );
}

      return res.status(200).json({
        message: "Follow request accepted.",
        request,
      });
    } catch (error) {
      console.error("Accept follow request error:", error);

      return res.status(500).json({
        message: "Failed to accept follow request.",
      });
    }
  },
);

// Reject an incoming follow request
router.delete(
  "/follow-requests/:requestId",
  authMiddleware,
  async (req, res) => {
    try {
      const { requestId } = req.params;

      if (!mongoose.isValidObjectId(requestId)) {
        return res.status(400).json({
          message: "Invalid request ID.",
        });
      }

      const request = await Follow.findOne({
        _id: requestId,
        following: req.user.id,
        status: "pending",
      });

      if (!request) {
        return res.status(404).json({
          message: "Pending follow request not found.",
        });
      }

      await request.deleteOne();

      await removeFollowRequestNotification(
        request.follower,
        request.following,
      );

      return res.status(200).json({
        message: "Follow request rejected.",
      });
    } catch (error) {
      console.error("Reject follow request error:", error);

      return res.status(500).json({
        message: "Failed to reject follow request.",
      });
    }
  },
);

// Get follower/following counts and the current user's relationship status
router.get("/:id/follow-status", authMiddleware, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    if (!mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const [followersCount, followingCount, existingFollow, followsYou] =
      await Promise.all([
        Follow.countDocuments({
          following: targetUserId,
          status: "accepted",
        }),

        Follow.countDocuments({
          follower: targetUserId,
          status: "accepted",
        }),

        Follow.findOne({
          follower: currentUserId,
          following: targetUserId,
        }),

        Follow.findOne({
          follower: targetUserId,
          following: currentUserId,
          status: "accepted",
        }),
      ]);

return res.status(200).json({
  followersCount,
  followingCount,
  isFollowing: existingFollow?.status === "accepted",
  followsYou: Boolean(followsYou),
  requestPending: existingFollow?.status === "pending",
  isPrivate: Boolean(targetUser.isPrivate),
});
  } catch (error) {
    console.error("Get follow status error:", error);

    return res.status(500).json({
      message: "Failed to get follow status.",
    });
  }
});


// Get accepted followers and following for comment mentions.
router.get("/mention-users", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const relationships = await Follow.find({
      status: "accepted",
      $or: [{ follower: userId }, { following: userId }],
    }).select("follower following");

    const userIds = new Set();

    relationships.forEach((relationship) => {
      const followerId = relationship.follower.toString();
      const followingId = relationship.following.toString();

      if (followerId !== userId.toString()) {
        userIds.add(followerId);
      }

      if (followingId !== userId.toString()) {
        userIds.add(followingId);
      }
    });

    const users = await User.find({
      _id: { $in: [...userIds] },
    }).select("_id name avatar");

    return res.json(users);
  } catch (error) {
    console.error("Get mention users error:", error);

    return res.status(500).json({
      message: "Failed to get mention users.",
    });
  }
});

export default router;
