/** The app icon artwork: a navy paw on coral, drawn for next/og image generation. */
export function PawMark({ size, radius }: { size: number; radius: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "#ff7a45",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="#1b1f3b">
        <circle cx="5.5" cy="9.5" r="2.2" />
        <circle cx="9.5" cy="5.2" r="2.2" />
        <circle cx="14.5" cy="5.2" r="2.2" />
        <circle cx="18.5" cy="9.5" r="2.2" />
        <path d="M12 11c-3.2 0-6 3.6-6 6.2C6 19 7.3 20 9 20c1.2 0 2-.6 3-.6s1.8.6 3 .6c1.7 0 3-1 3-2.8 0-2.6-2.8-6.2-6-6.2z" />
      </svg>
    </div>
  );
}
