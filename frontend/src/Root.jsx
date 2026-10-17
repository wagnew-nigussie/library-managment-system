import React, { useEffect, useState } from "react";
import App from "./App.jsx";
import Login from "./Login.jsx";
import {
  apiRequest,
  getAuthToken,
  saveAuthSession,
  clearAuthSession
} from "./services/apiClient.js";

export default function Root() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      setChecking(false);
      return;
    }

    apiRequest("/auth/me")
      .then((result) => {
        if (!result.data?.user) {
          throw new Error("Invalid session");
        }
        saveAuthSession(token, result.data.user);
        setUser(result.data.user);
      })
      .catch(() => {
        clearAuthSession();
        setUser(null);
      })
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(email, password) {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    if (!result.data?.token || !result.data?.user) {
      throw new Error("Login response is incomplete.");
    }

    saveAuthSession(result.data.token, result.data.user);
    setUser(result.data.user);
  }

  function handleLogout() {
    clearAuthSession();
    setUser(null);
  }

  if (checking) {
    return (
      <div className="auth-screen">
        <div className="auth-card auth-loading">
          <div className="brand-mark">L</div>
          <h1>Libra</h1>
          <p>Checking your sign-in session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      <div className="authenticated-banner">
        <div>
          <strong>{user.fullName}</strong>
          <span>{user.isSuperAdmin ? "Super Admin" : user.email}</span>
        </div>
        <button type="button" onClick={handleLogout}>
          Sign out
        </button>
      </div>
      <App key={user.id} user={user} />
    </>
  );
}
