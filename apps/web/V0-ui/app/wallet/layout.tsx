import { BottomNav } from "@/components/bottom-nav"

export default function WalletLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  )
}
