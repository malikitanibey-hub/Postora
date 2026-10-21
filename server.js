import express, { json } from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import User from "./routes/Users.js";
import Post from "./routes/Posts.js";
import Comment from "./routes/Comments.js";
import Notification from "./routes/Notifications.js";
import cookieParser from "cookie-parser";
import Follow from "./routes/Follow.js";
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    httpOnly: true,
  }),
);

//Make io accessible in routes
app.set("io", io);

app.use(cookieParser());
app.use(express.json());

app.use("/users", Follow);
app.use("/users", User);
app.use("/posts", Post);
app.use("/comments", Comment);
app.use("/notifications", Notification);


 // Socket.IO connection handling
const userSockets = new Map();

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  socket.on("user:join", (userId) => {
    if (!userId) {
      console.log(`Socket ${socket.id} tried to join without a user ID`);
      return;
    }

    const normalizedUserId = userId.toString();

    // Store all browser connections for this user.
    if (!userSockets.has(normalizedUserId)) {
      userSockets.set(normalizedUserId, new Set());
    }

    userSockets.get(normalizedUserId).add(socket.id);

    // Join a personal room shared by all the user's browsers.
    socket.join(`user:${normalizedUserId}`);

    console.log(
      `User ${normalizedUserId} joined with Socket ${socket.id}`
    );
  });

  socket.on("disconnect", () => {
    for (const [userId, socketIds] of userSockets.entries()) {
      if (socketIds.has(socket.id)) {
        socketIds.delete(socket.id);

        if (socketIds.size === 0) {
          userSockets.delete(userId);
        }

        console.log(`Socket ${socket.id} disconnected for user ${userId}`);
        break;
      }
    }
  });
});

// Export for use in routes
export { io, userSockets };


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected Successfully");
    httpServer.listen(5000, () => {
      console.log("Server Running On Port 5000");
    });
  })
  .catch((err) => console.log(err));
