import Image from "next/image";
import type { ReactNode } from "react";

export function PawIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="5.5" cy="9.5" r="2.2" />
      <circle cx="9.5" cy="5.2" r="2.2" />
      <circle cx="14.5" cy="5.2" r="2.2" />
      <circle cx="18.5" cy="9.5" r="2.2" />
      <path d="M12 11c-3.2 0-6 3.6-6 6.2C6 19 7.3 20 9 20c1.2 0 2-.6 3-.6s1.8.6 3 .6c1.7 0 3-1 3-2.8 0-2.6-2.8-6.2-6-6.2z" />
    </svg>
  );
}

/** The business mark: the uploaded logo (or the paw) and name. Use BrandLogo to read them from Settings. */
export function Logo({ dark = false, name = "Pawsitive HQ", logo = null, small = false }: { dark?: boolean; name?: string; logo?: string | null; small?: boolean }) {
  const box = small ? "size-9 rounded-xl" : "size-11 rounded-[14px]";
  return (
    <span className="flex min-w-0 items-center gap-3">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- an uploaded data URL
        <img src={logo} alt="" className={`${box} shrink-0 bg-white object-cover`} />
      ) : (
        <span className={`inline-flex ${box} shrink-0 items-center justify-center bg-coral text-ink`}>
          <PawIcon className={small ? "size-5" : "size-6"} />
        </span>
      )}
      <span className={`truncate font-display font-semibold ${small ? "text-lg" : "text-[22px]"} ${dark ? "text-white" : "text-ink"}`}>{name}</span>
    </span>
  );
}

/** A pet photo from /public or an uploaded data URL. */
export function PetPhoto({
  src,
  alt,
  className = "",
  sizes = "96px",
  priority = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <span className={`relative block overflow-hidden bg-lilac-soft ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={src.startsWith("data:")}
          className="object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-lilac-ink">
          <PawIcon className="size-1/2" />
        </span>
      )}
    </span>
  );
}

export function Pill({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${className}`}>{children}</span>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-3xl bg-white shadow-card ${className}`}>{children}</div>;
}

export function SectionTitle({ id, children, aside }: { id?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
      <h2 id={id} className="font-display text-[26px] font-semibold">
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function Initials({ name, className = "bg-sun text-ink", size = "size-10" }: { name: string; className?: string; size?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${size} ${className}`}>
      {initials}
    </span>
  );
}
