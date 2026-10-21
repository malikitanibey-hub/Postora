const COMMENTS = `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/comments`;

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || "Request failed");
  }

  return data;
}

// Get all comments for a post.
export const getCommentsByPost = (postId) =>
  request(`${COMMENTS}/${postId}`);

// Add a new comment.
export async function addComment(postId, text, mentions = []) {
  return request(`${COMMENTS}/${postId}`, {
    method: "POST",
    body: JSON.stringify({ text, mentions }),
  });
}

// Add a reply directly to a comment.
export async function addReply(commentId, text, mentions = []) {
  return request(`${COMMENTS}/reply/${commentId}`, {
    method: "POST",
    body: JSON.stringify({ text, mentions }),
  });
}

// Add a reply to another reply.
export async function addNestedReply(
  commentId,
  parentReplyId,
  text,
  mentions = [],
) {
  return request(`${COMMENTS}/reply/${commentId}/${parentReplyId}`, {
    method: "POST",
    body: JSON.stringify({ text, mentions }),
  });
}

// Get the number of comments on a post.
export const getCommentCount = async (postId) => {
  const data = await request(`${COMMENTS}/count/${postId}`);
  return data.count;
};

// Delete a comment.
export const deleteComment = (commentId) =>
  request(`${COMMENTS}/${commentId}`, {
    method: "DELETE",
  });

// Delete a reply at any nesting level.
export const deleteReply = (commentId, replyId) =>
  request(`${COMMENTS}/${commentId}/reply/${replyId}`, {
    method: "DELETE",
  });

// Like or unlike a comment.
export const toggleCommentLike = (commentId) =>
  request(`${COMMENTS}/${commentId}/like`, {
    method: "POST",
  });

// Like or unlike a reply at any nesting level.
export const toggleReplyLike = (commentId, replyId) =>
  request(`${COMMENTS}/${commentId}/reply/${replyId}/like`, {
    method: "POST",
  });