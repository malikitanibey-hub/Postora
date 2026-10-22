import express from "express";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authMiddleware } from "../middleware/AuthMiddleware.js";
import imagekit from "../utils/imagekit.js";
import multer from "multer";
import googleClient from "../utils/googleAuth.js";
import { sendPasswordResetCode } from "../utils/email.js";
import Follow from "../models/Follow.js";
import Post from "../models/Posts.js";
import Comment from "../models/Comments.js";
import Notification from "../models/notification.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, //still login for 1 week
  });
}

function removeUserReplies(replies, userId, removedIds) {
  return replies.filter((reply) => {
    const isUsersReply = String(reply.user) === userId;

    if (isUsersReply) {
      if (reply._id) removedIds.push(reply._id);

      if (reply.replies?.length) {
        collectReplyIds(reply.replies, removedIds);
      }

      return false;
    }

    if (reply.replies?.length) {
      reply.replies = removeUserReplies(reply.replies, userId, removedIds);
    }

    if (reply.likes?.length) {
      reply.likes = reply.likes.filter((id) => String(id) !== userId);
    }

    return true;
  });
}

function collectReplyIds(replies, ids) {
  for (const reply of replies) {
    if (reply._id) ids.push(reply._id);

    if (reply.replies?.length) {
      collectReplyIds(reply.replies, ids);
    }
  }
}

//POST
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    setAuthCookie(res, token);

    res.status(201).json({
      message: "User Registered Successfully",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    //11000 is duplicate key error code for email already used
    if (error.code === 11000) {
      return res.status(409).json({ error: "Email Already Used" });
    }
    res.status(500).json({ error: error.message });
  }
});

//LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        error: "User Not Found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        error: "Invalid Password",
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    setAuthCookie(res, token);

    res.status(201).json({
      message: "User Logged in Successfully",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// FORGOT PASSWORD - REQUEST CODE
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    // Do not reveal whether the email exists
    if (!user) {
      return res.json({
        message:
          "If an account exists with this email, a verification code has been generated.",
      });
    }

    // Generate a 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Code expires after 10 minutes
    user.resetPasswordCode = resetCode;
    user.resetPasswordCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.resetPasswordPurpose = "reset";

    await user.save();

    await sendPasswordResetCode(user.email, resetCode);

    res.json({
      message:
        "If an account exists with this email, a verification code has been generated.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

// VERIFY RESET CODE
router.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        error: "Email and verification code are required",
      });
    }

    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetPasswordPurpose: "reset",
    });

    if (!user) {
      return res.status(400).json({
        error: "Invalid verification code",
      });
    }

    if (
      !user.resetPasswordCodeExpires ||
      user.resetPasswordCodeExpires < new Date()
    ) {
      return res.status(400).json({
        error: "Verification code has expired",
      });
    }

    res.json({
      message: "Verification code verified successfully",
    });
  } catch (error) {
    console.error("Verify Reset Code Error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

// RESET PASSWORD
router.put("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        error: "Email, verification code and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "New password must be at least 6 characters",
      });
    }

    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetPasswordPurpose: "reset",
    });

    if (!user) {
      return res.status(400).json({
        error: "Invalid verification code",
      });
    }

    if (
      !user.resetPasswordCodeExpires ||
      user.resetPasswordCodeExpires < new Date()
    ) {
      return res.status(400).json({
        error: "Verification code has expired",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    // Clear reset code after successful password reset
    user.resetPasswordCode = null;
    user.resetPasswordCodeExpires = null;
    user.resetPasswordPurpose = null;

    // If the account was created with Google,

    await user.save();

    res.json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
});

// CHANGE PASSWORD OR CREATE A PASSWORD FOR A GOOGLE ACCOUNT
router.put("/me/password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword, verificationCode } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        error: "New password must be at least 8 characters",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Google account that does not have a Postora password yet.
    if (!user.password) {
      if (!verificationCode) {
        return res.status(400).json({
          error: "Email verification code is required",
        });
      }

      if (
        user.resetPasswordPurpose !== "create-password" ||
        user.resetPasswordCode !== String(verificationCode) ||
        !user.resetPasswordCodeExpires ||
        user.resetPasswordCodeExpires < new Date()
      ) {
        return res.status(400).json({
          error: "Invalid or expired verification code. Request a new one.",
        });
      }
    } else {
      // Existing password accounts must verify their current password.
      if (!currentPassword) {
        return res.status(400).json({
          error: "Current password is required",
        });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        return res.status(400).json({
          error: "Current password is incorrect",
        });
      }
    }

    user.password = await bcrypt.hash(newPassword, 10);

    // Invalidate any outstanding verification code.
    user.resetPasswordCode = null;
    user.resetPasswordCodeExpires = null;
    user.resetPasswordPurpose = null;

    await user.save();

    return res.json({
      message:
        user.authProvider === "google" && !currentPassword
          ? "Password created successfully"
          : "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      error: "Failed to update password",
    });
  }
});

//LOGOUT
router.post("/logout", async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
  res.json({ message: "Logged out Successfully" });
});

// GET MY PROFILE
router.get("/me/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: "User Not Found",
      });
    }

    const profile = user.toObject();

    // Never expose password hashes or verification codes.
    delete profile.password;
    delete profile.resetPasswordCode;
    delete profile.resetPasswordCodeExpires;
    delete profile.resetPasswordPurpose;

    // Tell the frontend whether a password exists.
    profile.hasPassword = Boolean(user.password);

    return res.json(profile);
  } catch (error) {
    console.error("Get my profile error:", error);

    return res.status(500).json({
      error: "Could not load your profile",
    });
  }
});


// UPDATE MY PROFILE NAME AND BIO
router.put("/me/profile", authMiddleware, async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const bio = req.body.bio?.trim() ?? "";

    if (!name) {
      return res.status(400).json({
        error: "Name is required",
      });
    }

    if (name.length > 50) {
      return res.status(400).json({
        error: "Name cannot exceed 50 characters",
      });
    }

    if (bio.length > 160) {
      return res.status(400).json({
        error: "Bio cannot exceed 160 characters",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { name, bio } },
      { new: true, runValidators: true },
    ).select(
      "-password -resetPasswordCode -resetPasswordCodeExpires -resetPasswordPurpose",
    );

    if (!updatedUser) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("Update profile error:", error);

    res.status(500).json({
      error: "Failed to update profile",
    });
  }
});

// UPDATE ACCOUNT PRIVACY
router.put("/me/privacy", authMiddleware, async (req, res) => {
  try {
    const { isPrivate } = req.body;

    if (typeof isPrivate !== "boolean") {
      return res.status(400).json({
        error: "isPrivate must be true or false",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { isPrivate } },
      {
        new: true,
        runValidators: true,
      },
    ).select("-password -resetPasswordCode -resetPasswordCodeExpires");

    if (!user) {
      return res.status(404).json({
        error: "User Not Found",
      });
    }

    res.json({
      message: `Account is now ${isPrivate ? "private" : "public"}`,
      user: {
        id: user._id,
        isPrivate: user.isPrivate,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// GOOGLE LOGIN
router.get("/google", (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });

  res.redirect(url);
});

// GOOGLE CALLBACK
router.get("/google/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        error: "Google Authorization Code Missing",
      });
    }

    // Exchange Google's authorization code for tokens
    const { tokens } = await googleClient.getToken(code);

    // Verify Google's ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const googleEmail = payload.email;
    const googleName = payload.name;

    if (!googleEmail) {
      return res.status(400).json({
        error: "Google Account Email Not Found",
      });
    }

    // Find existing user by email
    let user = await User.findOne({
      email: googleEmail,
    });

    // Create a new user if one doesn't exist
    if (!user) {
      user = new User({
        name: googleName || "Google User",
        email: googleEmail,
        password: null,
        authProvider: "google",
      });

      await user.save();
    }

    // Create Postora JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Store JWT in HTTP-only cookie
    setAuthCookie(res, token);

    // Redirect back to React
    res.redirect("http://localhost:3000/");
  } catch (error) {
    console.error("Google Login Error:", error);

    res.status(500).json({
      error: "Google Login Failed",
    });
  }
});

/* SEARCH USERS */
router.get("/search", authMiddleware, async (req, res) => {
  try {
    const query = req.query.q?.trim();

    if (!query) {
      return res.json([]);
    }

    // Treat the user's input as plain text, not a regex pattern.
    const escapedQuery = query
      .slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const users = await User.find({
      _id: { $ne: req.user.id },
      name: { $regex: escapedQuery, $options: "i" },
    })
      .select("_id name avatar")
      .sort({ name: 1 })
      .limit(20);

    res.json(users);
  } catch (error) {
    console.error("Search Users Error:", error);
    res.status(500).json({ error: "Failed to search users" });
  }
});

// UPDATE USER AVATAR
router.put(
  "/:id/avatar",
  authMiddleware,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Make sure the user can only update their own avatar
      if (id !== req.user.id) {
        return res.status(403).json({
          error: "Not Authorized",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "No avatar image provided",
        });
      }

      const result = await imagekit.files.upload({
        file: req.file.buffer.toString("base64"),
        fileName: `avatar-${Date.now()}-${req.file.originalname}`,
        folder: "/avatars",
      });

      const user = await User.findByIdAndUpdate(
        id,
        { avatar: result.url },
        { returnDocument: "after" },
      ).select("-password");

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// REMOVE USER AVATAR
router.delete("/:id/avatar", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Make sure the user can only remove their own avatar
    if (id !== req.user.id) {
      return res.status(403).json({
        error: "Not Authorized",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { avatar: "/avatar.png" },
      { returnDocument: "after" },
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        error: "User Not Found",
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// REQUEST A SETTINGS VERIFICATION CODE
router.post("/me/verification-code", authMiddleware, async (req, res) => {
  try {
    const { purpose } = req.body;

    if (!["create-password", "delete-account"].includes(purpose)) {
      return res.status(400).json({
        error: "Invalid verification purpose",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (purpose === "create-password" && user.password) {
      return res.status(400).json({
        error:
          "Your account already has a password. Use the change-password form.",
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordCode = code;
    user.resetPasswordCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.resetPasswordPurpose = purpose;

    await user.save();

    await sendPasswordResetCode(user.email, code);

    return res.json({
      message: "Verification code sent to the Postora email inbox.",
    });
  } catch (error) {
    console.error("Settings verification error:", error);
    return res.status(500).json({
      error: "Could not request a verification code.",
    });
  }
});

// DELETE ACCOUNT
router.delete("/me", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, verificationCode } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Local accounts must confirm their current password.
    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({
          error: "Enter your current password to delete your account",
        });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        return res.status(400).json({
          error: "Current password is incorrect",
        });
      }
    } else {
      // Accounts without a password must verify their email code.
      if (
        !verificationCode ||
        user.resetPasswordPurpose !== "delete-account" ||
        user.resetPasswordCode !== String(verificationCode) ||
        !user.resetPasswordCodeExpires ||
        user.resetPasswordCodeExpires < new Date()
      ) {
        return res.status(400).json({
          error: "Invalid or expired verification code. Request a new one.",
        });
      }
    }

    // Collect this user's posts before deleting them.
    const posts = await Post.find({ user: userId }).select("_id");
    const postIds = posts.map((post) => post._id);

    // Collect comment/reply IDs that will be removed.
    const comments = await Comment.find({});
    const removedCommentIds = [];
    const topLevelCommentIdsToDelete = [];

    for (const comment of comments) {
      if (String(comment.user) === userId) {
        if (comment._id) {
          topLevelCommentIdsToDelete.push(comment._id);
          removedCommentIds.push(comment._id);
        }

        if (comment.replies?.length) {
          collectReplyIds(comment.replies, removedCommentIds);
        }

        continue;
      }

      const originalReplyCount = comment.replies?.length || 0;

      if (comment.replies?.length) {
        comment.replies = removeUserReplies(
          comment.replies,
          userId,
          removedCommentIds,
        );
      }

      if (comment.likes?.length) {
        comment.likes = comment.likes.filter((id) => String(id) !== userId);
      }

      // Also remove this user's likes from remaining nested replies.
      if (comment.replies?.length || originalReplyCount) {
        await comment.save();
      } else if (comment.isModified()) {
        await comment.save();
      }
    }

    // Delete comments written by the account being removed.
    if (topLevelCommentIdsToDelete.length) {
      await Comment.deleteMany({
        _id: { $in: topLevelCommentIdsToDelete },
      });
    }

    // Delete the user's posts.
    if (postIds.length) {
      await Post.deleteMany({ _id: { $in: postIds } });

      // Remove deleted posts from other users' saved posts.
      await User.updateMany({}, { $pull: { savedPosts: { $in: postIds } } });
    }

    // Remove this user's likes from other posts.
    await Post.updateMany(
      { user: { $ne: userId } },
      { $pull: { likes: userId } },
    );

    // Remove all follow relationships involving this user.
    await Follow.deleteMany({
      $or: [{ follower: userId }, { following: userId }],
    });

    // Remove notifications involving this user or their deleted content.
    await Notification.deleteMany({
      $or: [
        { sender: userId },
        { recipient: userId },
        { post: { $in: postIds } },
        { comment: { $in: removedCommentIds } },
      ],
    });

    // Finally, delete the account itself.
    await User.findByIdAndDelete(userId);

    // Clear the login cookie.
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    return res.json({
      message: "Your account and associated content have been deleted.",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({
      error: "Failed to delete account",
    });
  }
});

/* GET ANY USER PROFILE */
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name bio avatar isPrivate createdAt",
    );

    if (!user) {
      return res.status(404).json({
        error: "User Not Found",
      });
    }

    // Identify the logged-in user from the authentication cookie.
    let currentUserId = null;
    const token = req.cookies?.token;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUserId = decoded.id;
      } catch {
        // An invalid or expired cookie does not grant access.
        currentUserId = null;
      }
    }

    const isOwner = currentUserId && currentUserId === user._id.toString();

    let canViewPosts = !user.isPrivate || Boolean(isOwner);

    if (user.isPrivate && currentUserId && !isOwner) {
      const acceptedFollow = await Follow.findOne({
        follower: currentUserId,
        following: user._id,
        status: "accepted",
      });

      canViewPosts = Boolean(acceptedFollow);
    }

    return res.json({
      _id: user._id,
      name: user.name,
      bio: user.bio || "",
      avatar: user.avatar,
      isPrivate: Boolean(user.isPrivate),
      createdAt: user.createdAt,
      canViewPosts,
    });
  } catch (error) {
    console.error("Get user profile error:", error);

    return res.status(500).json({
      error: "Failed to get user profile",
    });
  }
});

export default router;
