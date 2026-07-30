import clsx from "clsx";

interface AvatarProps {
  name: string;
  online?: boolean;
  size?: number;
  showStatus?: boolean;
  className?: string;
}

// Deterministic pastel hue from the name so each person gets a stable,
// distinct avatar color without needing uploaded photos.
function hueFromName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Avatar({ name, online, size = 44, showStatus = true, className }: AvatarProps) {
  const hue = hueFromName(name || "?");
  return (
    <div className={clsx("relative shrink-0", className)} style={{ width: size, height: size }}>
      <div
        className="w-full h-full rounded-full flex items-center justify-center font-semibold text-white select-none"
        style={{
          background: `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 40) % 360}, 70%, 45%))`,
          fontSize: size * 0.36,
        }}
      >
        {initials(name || "?")}
      </div>
      {showStatus && (
        <span
          className={clsx(
            "absolute bottom-0 right-0 rounded-full border-2 border-surface-bright dark:border-surface-dark",
            online ? "bg-emerald-400" : "bg-slate-400"
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
