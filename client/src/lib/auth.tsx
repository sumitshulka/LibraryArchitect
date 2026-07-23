import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  category: string;
  isLocalUser: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const checkSession = async () => {
    try {
      const sid = localStorage.getItem("session_id");
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        headers: sid ? { Authorization: `Bearer ${sid}` } : undefined,
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        queryClient.invalidateQueries({ queryKey: ["system-config"] });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Session check failed:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.sessionId) {
          localStorage.setItem("session_id", data.sessionId);
        }
        setUser(data.user);
        queryClient.invalidateQueries({ queryKey: ["system-config"] });
        return { success: true };
      } else {
        return { success: false, error: data.error || "Login failed" };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("session_id");
      setUser(null);
      setLocation("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      isLoading: true,
      isAuthenticated: false,
      login: async () => ({ success: false, error: "Auth not initialized" }),
      logout: async () => {},
      checkSession: async () => {},
    };
  }
  return context;
}
