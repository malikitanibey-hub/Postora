import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useAuth } from "../authContext/UserContext";
import { io } from "socket.io-client";

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const getPreference = (key, fallback = true) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const { user, loading } = useAuth();
  const audioRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/notifications`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await res.json();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/notifications/unread-count`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch unread count");
      }

      const data = await res.json();
      setUnreadCount(data.count);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, []);

  const removeNotification = useCallback(
    (notificationId) => {
      const notification = notifications.find(
        (item) => item._id === notificationId,
      );

      setNotifications((prev) =>
        prev.filter((item) => item._id !== notificationId),
      );

      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    },
    [notifications],
  );

  const markAsSeen = useCallback(
    async (notificationId) => {
      try {
        const res = await fetch(
          `${API_URL}/notifications/${notificationId}/read`,
          {
            method: "PATCH",
            credentials: "include",
          },
        );

        if (!res.ok) {
          throw new Error("Failed to mark notification as seen");
        }

        const updatedNotification = await res.json();

        setNotifications((prev) =>
          prev.map((notification) =>
            notification._id === notificationId
              ? { ...notification, ...updatedNotification }
              : notification,
          ),
        );

        await fetchUnreadCount();
        return true;
      } catch (error) {
        console.error(error);
        return false;
      }
    },
    [fetchUnreadCount],
  );

  const markAllAsSeen = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/notifications/read-all`, {
        method: "PATCH",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to mark all notifications as seen");
      }

      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          read: true,
        })),
      );

      setUnreadCount(0);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setSocket(null);
      setNotifications([]);
      setUnreadCount(0);
      audioRef.current = null;
      return;
    }

    const userId = user._id || user.id;
    if (!userId) return;

    let active = true;

    audioRef.current = new Audio("/sounds/notification.mp3");
    audioRef.current.preload = "auto";

    const unlockNotificationSound = () => {
      const audio = audioRef.current;

      if (!audio) return;

      audio.muted = true;

      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;

          window.removeEventListener("pointerdown", unlockNotificationSound);
          window.removeEventListener("keydown", unlockNotificationSound);
        })
        .catch(() => {
          audio.muted = false;
        });
    };

    window.addEventListener("pointerdown", unlockNotificationSound);
    window.addEventListener("keydown", unlockNotificationSound);

    const newSocket = io(API_URL, {
      withCredentials: true,
    });

    setSocket(newSocket);
    newSocket.emit("user:join", userId);

    newSocket.on("notification:new", (notification) => {
      if (!active) return;
      // console.log("New Postora notification:", notification);

      setNotifications((prev) => [
        notification,
        ...prev.filter((item) => item._id !== notification._id),
      ]);

      if (!notification.read) {
        setUnreadCount((prev) => prev + 1);
      }

      // Respect notification and sound preferences.
      const notificationsEnabled = getPreference("postoraNotifications", true);
      const soundEnabled = getPreference("postoraNotificationSound", true);

      if (notificationsEnabled && soundEnabled) {
        const audio = audioRef.current;

        if (audio) {
          audio.currentTime = 0;
          // audio.play().catch((error) => {
          //   console.debug("Notification sound could not play:", error);
          // });
          audio.play().catch(() => {
            // The browser may block sound until the user interacts with the page.
          });
        }
      }
    });

    fetchNotifications();
    fetchUnreadCount();

    return () => {
      active = false;

      window.removeEventListener("pointerdown", unlockNotificationSound);
      window.removeEventListener("keydown", unlockNotificationSound);

      newSocket.close();
      setSocket(null);
      audioRef.current = null;
    };
  }, [user, loading, fetchNotifications, fetchUnreadCount]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        notifications,
        unreadCount,
        fetchNotifications,
        fetchUnreadCount,
        markAsSeen,
        markAllAsSeen,
        removeNotification,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
