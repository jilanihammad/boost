import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Boost (v0)</h1>
      <p className="text-zinc-600">
        Minimal scaffold for merchant + consumer flows with Firebase Auth.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link className="rounded-md bg-black px-4 py-2 text-white" href="/login">
          Go to Login
        </Link>
        <Link className="rounded-md border px-4 py-2" href="/dashboard">
          Dashboard
        </Link>
        <Link className="rounded-md border px-4 py-2" href="/redeem">
          Redeem
        </Link>
        <Link className="rounded-md border px-4 py-2" href="/admin">
          Admin
        </Link>
      </div>
    </div>
  );
}
