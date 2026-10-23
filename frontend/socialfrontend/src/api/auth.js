const API = `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/users`;
// const token = localStorage.getItem("token") //if we use Authorization in file AuthMiddleware.js

//REGISTER
export async function registerApi(payload) {
  const res = await fetch(`${API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // if we use cookie AuthMiddleware.js
    //"Authorization": `Bearer ${token}` //if we use Authorization in file AuthMiddleware.js
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Register Failed");
  }
  return data;
}

//LOGIN
export async function loginApi(payload) {
  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // if we use cookie AuthMiddleware.js
    //"Authorization": `Bearer ${token}` //if we use Authorization in file AuthMiddleware.js
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Logged In Failed");
  }
  return data;
}

//LOGOUT
export async function logoutApi() {
  const res = await fetch(`${API}/logout`, {
    method: "POST",
    credentials: "include", // if we use cookie AuthMiddleware.js
    //"Authorization": `Bearer ${token}` //if we use Authorization in file AuthMiddleware.js
  });
  return res.json();
}

//GET ME
export async function getMeApi() {
  const res = await fetch(`${API}/me/profile`, {
    credentials: "include",
  });

  if (res.status === 401) {
    return null;
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to get user");
  }

  return data;
}


// UPDATE MY PROFILE
export const updateMyProfile = async (profileData) => {
  const response = await fetch(`${API}/me/profile`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profileData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Profile update failed.");
  }

  return data;
};


// GET ANY USER PROFILE
export async function getUserProfile(id) {
  const res = await fetch(`${API}/${id}`, {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to get user profile");
  }
  return data;
}

//UPDATE USER AVATAR
export async function updateMyAvatar(userId, file) {
  const formData = new FormData();
  formData.append("avatar", file);
const res = await fetch(`${API}/${userId}/avatar`, {
    method: "PUT",
    credentials: "include",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to update avatar");
  }
  return data;
}

// REMOVE USER AVATAR
export async function removeMyAvatar(userId) {
const res = await fetch(`${API}/${userId}/avatar`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to remove avatar");
  }

  return data;
}

// CHANGE OR CREATE PASSWORD
export async function changePasswordApi(payload) {
  const res = await fetch(`${API}/me/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to update password");
  }

  return data;
}

/* SEARCH USERS */
export async function searchUsers(query) {
  const res = await fetch(`${API}/search?q=${encodeURIComponent(query)}`, {
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to search users");
  }

  return data;
}

// REQUEST A SETTINGS VERIFICATION CODE
export async function requestSettingsVerificationCode(purpose) {
  const res = await fetch(`${API}/me/verification-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ purpose }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to request verification code");
  }

  return data;
}

// DELETE ACCOUNT
export async function deleteAccountApi(payload) {
  const res = await fetch(`${API}/me`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to delete account");
  }

  return data;
}
