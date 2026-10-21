import mongoose from "mongoose";

const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "accepted",
    },
  },
  { timestamps: true },
);

// Prevent duplicate follow relationships.
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Prevent users from following themselves.
followSchema.pre("validate", function () {
  if (this.follower.equals(this.following)) {
    this.invalidate("following", "Users cannot follow themselves.");
  }
});

export default mongoose.model("Follow", followSchema);
