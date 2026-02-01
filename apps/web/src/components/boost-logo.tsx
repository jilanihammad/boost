import { Zap } from "lucide-react"

export function BoostLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <Zap className="h-5 w-5 text-primary-foreground" />
      </div>
      <span className="text-xl font-semibold text-foreground">Boost</span>
    </div>
  )
}
