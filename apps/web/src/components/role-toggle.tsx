"use client"

import React from "react"

import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Shield, User, Crown } from "lucide-react"

// Displays the user's role from Firebase custom claims.
// Role is read-only (managed via admin panel).
export function RoleToggle() {
  const { role } = useAuth()

  const icon = role === "owner" ? <Crown className="h-4 w-4" /> :
               role === "merchant_admin" ? <Shield className="h-4 w-4" /> :
               <User className="h-4 w-4" />

  const label = role === "owner" ? "Owner" :
                role === "merchant_admin" ? "Admin" :
                role === "staff" ? "Staff" : "Guest"

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 border-border bg-secondary text-xs text-secondary-foreground"
      disabled
      title="Role is controlled by Firebase claims"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}
