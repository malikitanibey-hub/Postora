import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    required: true,
    type: String,
  },

  username: {
  type: String,
  unique: true,
  sparse: true,
  lowercase: true,
  trim: true,
  minlength: 3,
  maxlength: 20,
  match: /^[a-z0-9_]+$/,
},

  bio: {
    type: String,
    default: "",
    maxlength: 160,
  },

  email: {
    required: true,
    type: String,
    unique: true,
  },

  password: {
    type: String,
    default: null,
  },

  avatar: {
    type: String,
    default: "/avatar.png",
  },

  isPrivate: {
    type: Boolean,
    default: false,
  },

  authProvider: {
    type: String,
    enum: ["local", "google"],
    default: "local",
  },

  resetPasswordCode: {
    type: String,
    default: null,
  },

  resetPasswordCodeExpires: {
    type: Date,
    default: null,
  },

  resetPasswordPurpose: {
    type: String,
    enum: ["reset", "create-password", "delete-account", null],
    default: null,
  },

  // Posts saved by this user
  savedPosts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
  ],
});

export default mongoose.model("User", userSchema);
