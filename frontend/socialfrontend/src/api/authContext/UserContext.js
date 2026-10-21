import { createContext, useContext, useEffect, useState } from "react";
import { getMeApi, logoutApi } from "../auth";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);


useEffect(() => {
  const checkAuth = async () => {
    try {
      const data = await getMeApi();

      if (!data) {
        setUser(null);
        return;
      }

      setUser({
        ...data,
        id: data._id,
      });
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  checkAuth();
}, []);


  const logout = async () => {
    try {
      await logoutApi();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
