const API_URL = `${
  process.env.REACT_APP_API_URL || "http://localhost:5000"
}/users`;

// Get follow status and profile counts.
export const getFollowStatus = async (userId) => {
  const response = await fetch(`${API_URL}/${userId}/follow-status`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to get follow status");
  }

  return data;
};

// Follow a user or send a follow request.
export const followUser = async (userId) => {
  const response = await fetch(`${API_URL}/${userId}/follow`, {
    method: "POST",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to follow user");
  }

  return data;
};

// Unfollow a user or cancel a pending request.
export const unfollowUser = async (userId) => {
  const response = await fetch(`${API_URL}/${userId}/follow`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to unfollow user");
  }

  return data;
};

// Get incoming follow requests.
export const getFollowRequests = async () => {
  const response = await fetch(`${API_URL}/follow-requests`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to get follow requests");
  }

  return data;
};

// Accept a follow request.
export const acceptFollowRequest = async (requestId) => {
  const response = await fetch(
    `${API_URL}/follow-requests/${requestId}/accept`,
    {
      method: "PATCH",
      credentials: "include",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to accept follow request");
  }

  return data;
};

// Reject a follow request.
export const rejectFollowRequest = async (requestId) => {
  const response = await fetch(`${API_URL}/follow-requests/${requestId}`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to reject follow request");
  }

  return data;
};


// Get followers and following for @mention suggestions.
export const getMentionUsers = async () => {
  const response = await fetch(`${API_URL}/mention-users`, {
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to get mention users");
  }

  return data;
};
