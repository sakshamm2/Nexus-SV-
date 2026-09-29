import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";

type Props = { email: string | null; ready: boolean; onSignIn: () => void; onSignOut: () => void };

export default function Header({ email, ready, onSignIn, onSignOut }: Props) {
  return (
    <header className="glass flex items-center justify-between rounded-2xl px-4 py-2.5">
      {/* Top left: logo + product name */}
      <Link href="/" className="flex items-center gap-3">
        <Image src="/logo.png" alt="Nexus SV logo" width={44} height={34} priority />
        <span className="text-lg font-semibold tracking-tight">Nexus SV</span>
      </Link>

      {/* Top right: signed-in email, or a Sign in button for guests */}
      {ready &&
        (email ? (
          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-gray-300 sm:block">{email}</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-sm font-semibold">
              {email[0].toUpperCase()}
            </div>
            <button
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-lg p-2 text-gray-400 transition hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onSignIn}
            className="rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 px-5 py-2 text-sm font-medium text-white transition hover:brightness-110"
          >
            Sign in
          </button>
        ))}
    </header>
  );
}