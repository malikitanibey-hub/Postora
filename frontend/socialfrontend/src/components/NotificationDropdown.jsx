
import React, { useCallback, useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useSocket } from "../api/authContext/SocketContext";
import {
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
} from "../api/follows";

function NotificationDropdown() {
const {
  notifications,
  unreadCount,
  fetchNotifications,
  fetchUnreadCount,
} = useSocket();

  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingRequest, setProcessingRequest] = useState(null);
  const [dismissedNotifications, setDismissedNotifications] = useState([]);

  const loadFollowRequests = useCallback(async () => {
    setLoadingRequests(true);

    try {
      const data = await getFollowRequests();
      setRequests(data.requests || []);
    } catch (error) {
      toast.error(error.message || "Failed to load follow requests");
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);




const getNotificationText = (notification) => {
  if (notification.type === "follow_request") {
    return "requested to follow you";
  }

  if (notification.type === "follow_accepted") {
    return "accepted your follow request";
  }

  switch (notification.type) {
    case "like":
      return "liked your post";
    case "comment":
      return "commented on your post";
    case "reply":
      return "replied to your comment";
    default:
      return "interacted with your content";
  }
};


  const getRequestForNotification = (notification) => {
    return requests.find(
      (request) =>
        request.follower?._id === notification.sender?._id
    );
  };

  const handleRequestAction = async (notification, action) => {
  const request = getRequestForNotification(notification);

  if (!request) {
    toast.error("This follow request is no longer available.");
    await loadFollowRequests();
    return;
  }

  setProcessingRequest(request._id);

  try {
    if (action === "accept") {
      await acceptFollowRequest(request._id);
      toast.success("Follow request accepted.");
    } else {
      await rejectFollowRequest(request._id);
      toast.success("Follow request rejected.");
    }

    setRequests((current) =>
      current.filter((item) => item._id !== request._id)
    );

    setDismissedNotifications((current) => [
      ...current,
      notification._id,
    ]);

    // Refresh once after either action
    await fetchNotifications();
    await fetchUnreadCount();
  } catch (error) {
    toast.error(error.message || "Failed to update follow request");
  } finally {
    setProcessingRequest(null);
  }
};

  const visibleNotifications = (notifications || []).filter(
    (notification) =>
      !dismissedNotifications.includes(notification._id)
  );
  console.log("All notifications:", notifications);
console.log("Visible notifications:", visibleNotifications);

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (open) {
          loadFollowRequests();
          fetchUnreadCount();
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Open notifications"
          className="relative rounded-full p-2 transition hover:bg-gray-100"
        >
          <Bell size={22} />

          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(360px,calc(100vw-24px))] rounded-xl border border-gray-200 bg-white p-0 shadow-xl outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4">
<h3 className="text-lg font-bold text-gray-900">
  Notifications — TEST 123
</h3>
          </div>

          {/* Incoming follow requests */}
          {requests.length > 0 && (
            <div className="border-b p-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-700">
                Follow requests ({requests.length})
              </h4>

              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request._id}
                    className="flex items-center gap-3"
                  >
                    <img
                      src={request.follower?.avatar || "/avatar.png"}
                      alt={request.follower?.name || "User"}
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {request.follower?.name || "User"}
                      </p>
                      <p className="text-xs text-gray-500">
                        Wants to follow you
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={processingRequest === request._id}
                        onClick={async () => {
                          setProcessingRequest(request._id);

                          try {
                            await acceptFollowRequest(request._id);
                            setRequests((current) =>
                              current.filter(
                                (item) => item._id !== request._id
                              )
                            );
                            toast.success("Follow request accepted.");
                            await fetchNotifications();
                            await fetchUnreadCount();
                          } catch (error) {
                            toast.error(
                              error.message ||
                                "Failed to accept follow request"
                            );
                          } finally {
                            setProcessingRequest(null);
                          }
                        }}
                        className="rounded-lg bg-[#2764de] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Accept
                      </button>

                      <button
                        type="button"
                        disabled={processingRequest === request._id}
                        onClick={async () => {
                          setProcessingRequest(request._id);

                          try {
                            await rejectFollowRequest(request._id);
                            setRequests((current) =>
                              current.filter(
                                (item) => item._id !== request._id
                              )
                            );
                            toast.success("Follow request rejected.");
                            await fetchNotifications();
                            await fetchUnreadCount();
                          } catch (error) {
                            toast.error(
                              error.message ||
                                "Failed to reject follow request"
                            );
                          } finally {
                            setProcessingRequest(null);
                          }
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notifications list */}
          <div className="max-h-96 overflow-y-auto p-3">
            {loadingRequests && requests.length === 0 && (
              <p className="py-2 text-center text-xs text-gray-400">
                Loading follow requests...
              </p>
            )}

            {visibleNotifications.length === 0 && requests.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No notifications
              </p>
            ) : (
              <div className="space-y-2">
{visibleNotifications.map((notification) => {
  console.log("Notification list rendered:", visibleNotifications);

  // const request =
  //   notification.type === "follow_request"
  //     ? getRequestForNotification(notification)
  //     : null;

  console.log(
    "Displayed notification:",
    notification.type,
    notification.sender?.name,
    notification._id
  );

  return (
                    <div
                      key={notification._id}
                      className={`rounded-lg p-3 ${
                        notification.read
                          ? "bg-white"
                          : "bg-blue-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                          src={
                            notification.sender?.avatar || "/avatar.png"
                          }
                          alt={notification.sender?.name || "User"}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold text-gray-900">
                              {notification.sender?.name || "Someone"}
                            </span>
                            {getNotificationText(notification)}
                          </p>

                          {notification.post?.text && (
                            <p className="mt-1 truncate text-sm text-gray-500">
                              {notification.post.text}
                            </p>
                          )}

                          <p className="mt-1 text-xs text-gray-400">
                            {notification.createdAt
                              ? new Date(
                                  notification.createdAt
                                ).toLocaleString()
                              : ""}
                          </p>

                          
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default NotificationDropdown;
