import Link from "next/link";
import { cn } from "./cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group flex items-baseline gap-2.5", className)}
      aria-label="Dhvani, home"
    >
      <span
        aria-hidden
        className="font-deva text-[19px] leading-none text-saffron transition-colors group-hover:text-saffron-hi"
      >
        ध्वनि
      </span>
      <span className="font-display text-[22px] leading-none tracking-tight text-paper">
        Dhvani
      </span>
    </Link>
  );
}

/** Fixed instrument rail across the top of every page. */
export function Rail({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-line-soft bg-ink/85 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1180px] items-center justify-between px-6 sm:px-8">
        <Wordmark />
        <div className="flex items-center gap-6">{children}</div>
      </div>
    </header>
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
        "tag transition-colors hover:text-paper",
        active && "text-saffron",
      )}
    >
      {children}
    </Link>
  );
}
