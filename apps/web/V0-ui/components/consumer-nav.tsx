"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BoostLogo } from "@/components/boost-logo"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth-context"
import { Menu, X, Ticket, LogIn, Search } from "lucide-react"
import { cn } from "@/lib/utils"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/zones/gastown", label: "Deals", icon: Search },
]

export function ConsumerNav() {
  const pathname = usePathname()
  const { isAuthenticated, user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <BoostLogo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === link.href
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}

          {isAuthenticated ? (
            <>
              <Link
                href="/wallet"
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === "/wallet"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Ticket className="h-4 w-4" />
                My Wallet
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="ml-2 text-muted-foreground"
              >
                Sign Out
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button variant="default" size="sm" className="ml-2">
                <LogIn className="mr-1.5 h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}
        </nav>

        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-background p-0">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <BoostLogo />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex flex-col gap-1 p-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    pathname === link.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              ))}

              {isAuthenticated ? (
                <>
                  <Link
                    href="/wallet"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      pathname === "/wallet"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Ticket className="h-4 w-4" />
                    My Wallet
                  </Link>
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="px-3 text-xs text-muted-foreground">
                      Signed in as {user?.email}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        logout()
                        setOpen(false)
                      }}
                      className="mt-2 w-full justify-start text-muted-foreground"
                    >
                      Sign Out
                    </Button>
                  </div>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="mt-4"
                >
                  <Button variant="default" className="w-full">
                    <LogIn className="mr-1.5 h-4 w-4" />
                    Sign In
                  </Button>
                </Link>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
