import { motion } from "framer-motion";
import clsx from "clsx";
import { Avatar } from "../common/Avatar";
import type { OrbitItemLayout } from "../../hooks/useOrbitalWheel";

interface OrbitNodeProps {
  layout: OrbitItemLayout;
  name: string;
  online?: boolean;
  hasUnread?: boolean;
  onSelect: () => void;
}

export function OrbitNode({ layout, name, online, hasUnread, onSelect }: OrbitNodeProps) {
  const { translateX, translateY, scale, opacity, isActive } = layout;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      animate={{
        x: translateX,
        y: translateY,
        scale,
        opacity,
      }}
      transition={{ type: "tween", duration: 0.08, ease: "linear" }}
      style={{ position: "absolute", top: "50%", left: "50%" }}
      className={clsx(
        "flex items-center gap-3 -translate-x-1/2 -translate-y-1/2 rounded-full pl-1 pr-4 py-1",
        "will-change-transform pointer-events-auto select-none",
        isActive
          ? "bg-white/10 dark:shadow-glow-cyan shadow-md"
          : "bg-transparent"
      )}
      aria-current={isActive}
    >
      <div className="relative">
        <Avatar name={name} online={online} size={isActive ? 52 : 40} />
        {hasUnread && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-glow-violet border-2 border-surface-dark" />
        )}
      </div>
      <span
        className={clsx(
          "text-sm font-medium whitespace-nowrap transition-opacity",
          isActive ? "opacity-100 text-text-dark" : "opacity-0"
        )}
      >
        {name}
      </span>
    </motion.button>
  );
}
