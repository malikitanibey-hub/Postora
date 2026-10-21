const POSTS = "http://localhost:5000/posts";

//GET POSTS BY USER ID
export async function getPostsByUser(userId) {
  const res = await fetch(`${POSTS}/by-user/${userId}`, {
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to get user posts");
  }

  // console.log("getPostsByUser response:", data);

  return data;
}
//DELETE POST
export async function deletePost(postId) {
  const res = await fetch(`${POSTS}/${postId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Delete Failed");
  return data;
}

//LIKE POST
export async function toggleLike(postId) {
  const res = await fetch(`${POSTS}/likes/${postId}`, {
    method: "POST",
    credentials: "include",
    header: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}


/* SEARCH POSTS */
export async function searchPosts(query) {
  const res = await fetch(
    `${POSTS}/search?q=${encodeURIComponent(query)}`,
    {
      credentials: "include",
    },
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to search posts");
  }

  return data;
}

//Save Post
export async function toggleSavePost(postId) {
  const res = await fetch(`${POSTS}/save/${postId}`, {
    method: "POST",
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to save post");
  }

  return data;
}

//Get Saved Posts
export async function getSavedPosts() {
  const res = await fetch(`${POSTS}/saved`, {
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to load saved posts");
  }

  return data;
}