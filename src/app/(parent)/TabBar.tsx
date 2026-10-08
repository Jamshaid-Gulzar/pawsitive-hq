"use client";

import { BellRing, CalendarPlus, History, House, MessageCircle, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TABS = [
  { href: "/my", label: "Home", icon: House, match: (p: string) => p === "/my" || p.startsWith("/my/pets") || p.startsWith("/my/bookings") },
  {
    href: "/my/book",
    label: "Book",
    icon: CalendarPlus,
    match: (p: string) => (p.startsWith("/my/book") && !p.startsWith("/my/bookings")) || p.startsWith("/my/vet"), // also /my/vets (doctor profiles)
  },
  { href: "/my/inbox", label: "Updates", icon: MessageCircle, match: (p: string) => p.startsWith("/my/inbox") },
  { href: "/my/history", label: "History", icon: History, match: (p: string) => p.startsWith("/my/history") },
  { href: "/my/account", label: "Account", icon: UserRound, match: (p: string) => p.startsWith("/my/account") },
];

type Latest = { id: string; petId: string; petName: string; channel: "team" | "vet"; title: string | null; body: string } | null;

const POLL_MS = 5000;

export function TabBar({ unread }: { unread: number }) {
  const pathname = usePathname();
  const [polled, setPolled] = useState<number | null>(null);
  const [toast, setToast] = useState<Latest>(null);
  const lastId = useRef<string | null | undefined>(undefined);

  // A fresh server render (after navigating or reading a chat) is the source of truth.
  const [serverUnread, setServerUnread] = useState(unread);
  if (unread !== serverUnread) {
    setServerUnread(unread);
    setPolled(null);
  }
  const count = polled ?? unread;

  // Check for new messages and reminders every few seconds on every screen.
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const data: { unread: number; latest: Latest } = await res.json();
        setPolled(data.unread);
        const newest = data.latest?.id ?? null;
        // Pop up only for messages that arrive while the app is open, and not
        // for the chat that's already on screen.
        if (lastId.current !== undefined && newest && newest !== lastId.current) {
          const url = new URL(window.location.href);
          const viewing =
            url.pathname.startsWith("/my/inbox") &&
            url.searchParams.get("pet") === data.latest!.petId &&
            (url.searchParams.get("c") === "vet" ? "vet" : "team") === data.latest!.channel;
          if (!viewing) setToast(data.latest);
        }
        lastId.current = newest;
      } catch {
        // Offline for a moment; try again next tick.
      }
    };
    void check();
    const id = setInterval(check, POLL_MS);
    const onFocus = () => void check();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [count, pathname]);

  return (
    <>
      {toast && (
        <div role="status" className="fixed inset-x-0 top-[calc(72px+env(safe-area-inset-top))] z-50 mx-auto w-full max-w-[430px] px-3">
          <div className="animate-pop flex items-start gap-3 rounded-[20px] bg-ink p-3.5 text-white shadow-float">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-coral text-ink">
              <BellRing className="size-5" aria-hidden="true" />
            </span>
            <Link
              href={`/my/inbox?pet=${toast.petId}&c=${toast.channel}`}
              onClick={() => setToast(null)}
              className="min-w-0 flex-1"
            >
              <span className="block text-xs font-extrabold tracking-[0.06em] text-sun uppercase">
                {toast.petName} · {toast.channel === "vet" ? "Vet team" : "Pawsitive team"}
              </span>
              <span className="block truncate font-extrabold">{toast.title ?? "New message"}</span>
              <span className="line-clamp-2 text-sm text-[#d5d7ea]">{toast.body}</span>
            </Link>
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="-m-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full">
              <X className="size-4.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-sand bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="grid grid-cols-5">
          {TABS.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-extrabold"
                >
                  <span
                    className={`relative inline-flex h-8 w-12 items-center justify-center rounded-full transition ${
                      active ? "bg-coral-soft text-coral-ink" : "text-muted"
                    }`}
                  >
                    <Icon className="size-5.5" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                    {label === "Updates" && count > 0 && (
                      <span
                        key={count}
                        aria-label={`${count} unread`}
                        className="animate-pop absolute -top-1 right-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-white bg-coral px-1 text-[10px] text-ink"
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </span>
                  <span className={active ? "text-ink" : "text-muted"}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
