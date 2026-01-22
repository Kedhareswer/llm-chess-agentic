import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="border-b-2 border-black bg-white">
      <div className="flex h-12 items-center justify-between px-3">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="LLM Chess Arena" width={32} height={32} />
          <span className="text-base font-bold tracking-tight">LLM CHESS ARENA</span>
        </Link>

        <nav className="flex items-center gap-3">
          <Link href="/leaderboard" className="text-xs hover:underline">
            LEADERBOARD
          </Link>
        </nav>
      </div>
    </header>
  );
}
