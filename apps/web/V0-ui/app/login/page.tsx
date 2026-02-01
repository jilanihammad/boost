"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BoostLogo } from "@/components/boost-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { Mail, CheckCircle2, Loader2 } from "lucide-react"

type LoginState = "idle" | "loading" | "sent"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<LoginState>("idle")
  const { login } = useAuth()
  const router = useRouter()

  const handleGoogleSignIn = () => {
    // Mock Google sign-in
    login("merchant@boost.local")
    router.push("/redeem")
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setState("loading")
    // Simulate sending email link
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setState("sent")
  }

  const handleMockEmailClick = () => {
    // Simulate clicking the email link
    login(email)
    router.push("/redeem")
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BoostLogo />
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="space-y-1 pb-4 text-center">
            <h1 className="text-xl font-semibold text-card-foreground">
              Welcome back
            </h1>
            <CardDescription className="text-muted-foreground">
              Sign in to your merchant account
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={handleGoogleSignIn}
            >
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            {state === "sent" ? (
              <div className="space-y-4 rounded-lg border border-success/30 bg-success/10 p-4 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                <div>
                  <p className="font-medium text-foreground">Check your email</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We sent a sign-in link to{" "}
                    <span className="font-medium text-foreground">{email}</span>
                  </p>
                </div>
                <Button
                  variant="link"
                  className="text-primary"
                  onClick={handleMockEmailClick}
                >
                  Click here to simulate email link
                </Button>
              </div>
            ) : (
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@business.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border-border bg-input pl-10 text-foreground placeholder:text-muted-foreground"
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={state === "loading"}
                >
                  {state === "loading" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending link...
                    </>
                  ) : (
                    "Send sign-in link"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By signing in, you agree to our{" "}
          <a href="#" className="text-primary hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-primary hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </main>
  )
}
