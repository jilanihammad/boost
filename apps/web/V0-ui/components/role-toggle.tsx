"use client"

import React from "react"

import { useAuth, type UserRole } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Shield, User, ChevronDown } from "lucide-react"

export function RoleToggle() {
  const { role, setRole } = useAuth()

  const roles: { value: UserRole; label: string; icon: React.ReactNode }[] = [
    {
      value: "merchant_admin",
      label: "Admin",
      icon: <Shield className="h-4 w-4" />,
    },
    {
      value: "merchant_staff",
      label: "Staff",
      icon: <User className="h-4 w-4" />,
    },
  ]

  const currentRole = roles.find((r) => r.value === role)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-border bg-secondary text-xs text-secondary-foreground"
        >
          {currentRole?.icon}
          <span className="hidden sm:inline">{currentRole?.label}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {roles.map((r) => (
          <DropdownMenuItem
            key={r.value}
            onClick={() => setRole(r.value)}
            className={role === r.value ? "bg-accent" : ""}
          >
            {r.icon}
            <span className="ml-2">{r.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
