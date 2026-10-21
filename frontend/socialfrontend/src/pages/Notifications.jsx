import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSocket } from "../api/authContext/SocketContext";
import {
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
} from "../api/follows";

function Notifications() {
  const {
    notifications,
    unreadCount,
    markAsSeen,
    markAllAsSeen,
    removeNotification,
    fetchNotifications,
    fetchUnreadCount,
  } = useSocket();

  const navigate = useNavigate();


  const [appearance, setAppearance] = React.useState(
    () => localStorage.getItem("postoraAppearance") || "light",
  );

  React.useEffect(() => {
    const handleThemeChange = (event) => {
      setAppearance(
        event.detail?.appearance ||
        localStorage.getItem("postoraAppearance") ||
        "light",
      );
    };

    window.addEventListener("postora-theme-change", handleThemeChange);
    return () =>
      window.removeEventListener("postora-theme-change", handleThemeChange);
  }, []);

  const isDarkTheme = appearance === "dark";
  const isCustomTheme = appearance === "custom";

  const pageClass = isDarkTheme
    ? "bg-[#111318] text-gray-100 border-[#343843]"
    : isCustomTheme
      ? "bg-[#f5f3ff] text-[#292344] border-[#ded8f4]"
      : "bg-[#f8fafc] text-gray-900 border-gray-200";

  const headerClass = isDarkTheme
    ? "bg-[#111318] border-[#343843]"
    : isCustomTheme
      ? "bg-[#f5f3ff] border-[#ded8f4]"
      : "bg-[#f8fafc] border-gray-200";

  const mutedTextClass = isDarkTheme
    ? "text-gray-400"
    : isCustomTheme
      ? "text-[#77708e]"
      : "text-gray-500";

  const notificationRowClass = (read) => {
    if (isDarkTheme) {
      return read
        ? "bg-[#1b1e25] hover:bg-[#292d36] border-[#343843]"
        : "bg-[#222630] hover:bg-[#292d36] border-[#343843]";
    }

    if (isCustomTheme) {
      return read
        ? "bg-white hover:bg-[#e2dcf7] border-[#ded8f4]"
        : "bg-[#f0ecff] hover:bg-[#e2dcf7] border-[#ded8f4]";
    }

    return read
      ? "bg-white hover:bg-gray-50 border-gray-200"
      : "bg-blue-50/70 hover:bg-blue-50 border-gray-200";
  };

  const actionTextClass = isDarkTheme
    ? "text-[#7da5ff] hover:text-[#a8c2ff]"
    : isCustomTheme
      ? "text-[#6554c0] hover:text-[#5141a5]"
      : "text-[#2764de] hover:text-blue-700";

  const [followRequests, setFollowRequests] = React.useState([]);
  const [processingRequest, setProcessingRequest] = React.useState(null);

  const [refreshing, setRefreshing] = React.useState(false);


  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await Promise.all([
        fetchNotifications(),
        fetchUnreadCount(),
        loadFollowRequests(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const loadFollowRequests = async () => {
    try {
      const data = await getFollowRequests();
      setFollowRequests(Array.isArray(data) ? data : data?.requests || []);
    } catch (error) {
      console.error("Failed to load follow requests:", error);
    }
  };

  React.useEffect(() => {
    loadFollowRequests();
  }, []);

  const handleFollowRequest = async (notification, action) => {
    const request = followRequests.find(
      (item) =>
        (item.follower?._id || item.follower) === notification.sender?._id
    );

    if (!request) {
      toast.error("Follow request not found. Please refresh the page.");
      await loadFollowRequests();
      return;
    }

    setProcessingRequest(notification._id);

    try {
      if (action === "accept") {
        await acceptFollowRequest(request._id);
        toast.success("Follow request accepted");
      } else {
        await rejectFollowRequest(request._id);
        toast.success("Follow request rejected");
      }

      setFollowRequests((prev) =>
        prev.filter((item) => item._id !== request._id)
      );

      removeNotification(notification._id);

    } catch (error) {
      toast.error(`Couldn't ${action} follow request`);
    } finally {
      setProcessingRequest(null);
    }
  };



  const getMessage = (notification) => {
    if (notification.type === "follow_request") {
      return "requested to follow you";
    }

    if (notification.type === "follow_accepted") {
      return "accepted your follow request";
    }

    if (notification.type === "new_follower") {
      return "started following you";
    }

    switch (notification.type) {
      case "like":
        return "liked your post";

      case "comment":
        return "commented on your post";

      case "reply":
        return "replied to your comment";

      case "comment_like":
        return "liked your comment";

      case "reply_like":
        return "liked your reply";

      case "mention":
        return notification.comment
          ? "mentioned you in a comment or reply"
          : "mentioned you in a post";

      default:
        return "interacted with your content";
    }
  };


  const openNotification = async (notification) => {
    if (!notification.read) {
      await markAsSeen(notification._id);
    }

    // Follow notifications should open the sender's profile.
    if (
      ["follow_request", "follow_accepted", "new_follower"].includes(notification.type)
    ) {
      if (notification.sender?._id) {
        navigate(`/userDetails/${notification.sender._id}`);
      }
      return;
    }

    // Post notifications should open the related post.
    if (notification.post?._id) {
      navigate("/", {
        state: {
          openPostId: notification.post._id,
          focusCommentId: notification.comment?._id || null,
        },
      });
    } else {
      toast.info("This post is no longer available.");
    }
  };


  const handleMarkAllSeen = async () => {
    const success = await markAllAsSeen();

    if (success) {
      toast.success("All notifications marked as seen");
    } else {
      toast.error("Couldn't update notifications");
    }
  };

  return (
    <div
      className={`mx-auto min-h-screen w-full max-w-3xl border-x pt-16 md:pt-0 ${pageClass}`}
    >
      <div
        className={`sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 border-b p-4 backdrop-blur md:top-0 ${headerClass}`}
      >
        <div>
          <h1 className="text-xl font-bold">Notifications</h1>
          <p className={`text-sm ${mutedTextClass}`}>
            {unreadCount} unread
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex items-center gap-2 text-sm font-semibold ${mutedTextClass} ${actionTextClass} disabled:opacity-50`}
          >
            <RefreshCw
              size={18}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllSeen}
              className={`flex items-center gap-2 text-sm font-semibold hover:underline ${actionTextClass}`}
            >
              <CheckCheck size={18} />
              Mark all as seen
            </button>
          )}
        </div>
      </div>

      {!notifications?.length ? (
        <div
          className={`flex flex-col items-center justify-center px-4 py-20 text-center ${mutedTextClass}`}
        >
          <Bell size={40} className="mb-3" />
          <h2 className="font-semibold text-lg">No notifications yet</h2>
          <p className="text-sm mt-1">
            When someone interacts with your posts, you'll see it here.
          </p>
        </div>
      ) : (
        <div>
          {notifications.map((notification) => {
            const sender = notification.sender;

            return (
              <div
                key={notification._id}
                className={`flex items-start gap-3 border-b p-4 transition-colors ${notificationRowClass(notification.read)}`}
              >
                <Link
                  to={sender?._id ? `/userDetails/${sender._id}` : "/"}
                  onClick={(event) => event.stopPropagation()}
                  className="shrink-0"
                >
                  <img
                    src={sender?.avatar || "/avatar.png"}
                    alt={sender?.name || "User"}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6">
                    <Link
                      to={sender?._id ? `/userDetails/${sender._id}` : "/"}
                      onClick={(event) => event.stopPropagation()}
                      className="font-bold hover:underline"
                    >
                      {sender?.name || "Someone"}
                    </Link>{" "}
                    {getMessage(notification)}
                  </p>

                  {notification.post?.text && (
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className={`mt-1 block w-full truncate text-left text-sm ${mutedTextClass} ${actionTextClass}`}
                    >
                      {notification.post.text}
                    </button>
                  )}

                  <p className={`mt-1 text-xs ${mutedTextClass}`}>
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>

                  {notification.type === "follow_request" && (

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={processingRequest === notification._id}
                        onClick={() => handleFollowRequest(notification, "accept")}
                        className="rounded-lg bg-[#2764de] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Accept
                      </button>


                      <button
                        type="button"
                        disabled={processingRequest === notification._id}
                        onClick={() => handleFollowRequest(notification, "reject")}
                        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${isDarkTheme
                            ? "border-[#454a57] text-gray-200 hover:bg-[#292d36]"
                            : isCustomTheme
                              ? "border-[#ded8f4] text-[#373064] hover:bg-[#e2dcf7]"
                              : "border-gray-300 text-gray-700 hover:bg-gray-100"
                          }`}
                      >
                        Reject
                      </button>


                    </div>
                  )}


                  <div className="mt-2 flex items-center gap-4">
                    {["follow_request", "follow_accepted"].includes(notification.type) &&
                      notification.sender?._id && (
                        <button
                          type="button"
                          onClick={() => openNotification(notification)}
                          className="text-sm font-medium text-[#2764de] hover:underline"
                        >
                          View profile
                        </button>
                      )}

                    {["like", "comment", "reply", "mention"].includes(
                      notification.type
                    ) &&
                      notification.post?._id && (
                        <button
                          type="button"
                          onClick={() => openNotification(notification)}
                          className="text-sm font-medium text-[#2764de] hover:underline"
                        >
                          View post </button>
                      )}

                    {!notification.read && (
                      <button
                        type="button"
                        onClick={async () => {
                          const success = await markAsSeen(notification._id);


                          if (success) {
                            toast.success("Marked as seen");
                          } else {
                            toast.error("Couldn't update notification");
                          }
                        }}
                        className={`text-sm ${mutedTextClass} hover:underline`}
                      >
                        Mark as seen
                      </button>


                    )}

                  </div>

                </div>

                {!notification.read && (
                  <span
                    className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#2764de]"
                    title="Unread"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Notifications;
