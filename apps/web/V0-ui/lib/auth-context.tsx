"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export type UserRole = "merchant_staff" | "merchant_admin" | "consumer"

interface User {
  id: string
  email: string
  name: string
  role: UserRole
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  role: UserRole
  setRole: (role: UserRole) => void
  login: (email: string, opts?: { name?: string; role?: UserRole }) => void
  logout: () => void
  isConsumer: boolean
  isMerchant: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>({
    id: "user-1",
    email: "merchant@boost.local",
    name: "Alex Chen",
    role: "merchant_admin",
  })
  const [role, setRole] = useState<UserRole>("merchant_admin")

  const login = (email: string, opts?: { name?: string; role?: UserRole }) => {
    const loginRole = opts?.role ?? role
    setRole(loginRole)
    setUser({
      id: "user-1",
      email,
      name: opts?.name ?? "Alex Chen",
      role: loginRole,
    })
  }

  const logout = () => {
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        role,
        setRole,
        login,
        logout,
        isConsumer: user?.role === "consumer",
        isMerchant: user?.role === "merchant_admin" || user?.role === "merchant_staff",
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
