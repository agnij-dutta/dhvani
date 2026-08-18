import Link from "next/link";
import { cn } from "./cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group flex items-center gap-2", className)}
      aria-label="Dhvani, home"
    >
      <span className="font-display text-[15px] font-extrabold leading-none tracking-[-0.02em] text-black">
        Dhvani
      </span>
    </Link>
  );
}

/** Floating navigation capsule shared by every page. */
export function Rail({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <header
        className={cn("pointer-events-none sticky top-0 z-101", className)}
      >
        <div className="dark-rail pointer-events-auto flex w-full items-center justify-between rounded-full p-5">
          <Wordmark />
          <div className="flex items-center gap-1">{children}</div>
        </div>
      </header>

      <div
        aria-hidden="true"
        className="pointer-events-none sticky left-0 right-0 top-0 z-100 h-20 w-full bg-white mask-[linear-gradient(to_bottom,rgba(0,0,0,1)_0%,transparent_100%)]"
      />
    </>
  );
}

export function RailLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-1 text-[13px] font-medium transform-none text-black/65 transition-colors hover:bg-black/6 hover:text-black",
        active && "bg-black text-white hover:bg-black hover:text-white/80",
      )}
    >
      {children}
    </Link>
  );
}
