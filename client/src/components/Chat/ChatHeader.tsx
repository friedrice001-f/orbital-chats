import { Avatar } from "../common/Avatar";
import { IconButton } from "../common/IconButton";
import { BackIcon, SidebarIcon } from "../common/Icons";
import type { RoomSummary } from "../../types";

interface ChatHeaderProps {
  room: RoomSummary;
  isOnline?: boolean;
  memberCount?: number;
  typingLabel?: string | null;
  onBack?: () => void;
  onToggleDrawer: () => void;
}

export function ChatHeader({
  room,
  isOnline,
  memberCount,
  typingLabel,
  onBack,
  onToggleDrawer,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-black/5 dark:border-white/5 bg-surface-bright dark:bg-surface-dark-soft">
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <IconButton onClick={onBack} className="md:hidden" aria-label="Back to conversations">
            <BackIcon className="w-5 h-5" />
          </IconButton>
        )}
        <Avatar name={room.name} online={isOnline} size={40} showStatus={room.type === "dm"} />
        <div className="min-w-0">
          <p className="font-semibold text-text-bright dark:text-text-dark truncate">
            {room.name}
          </p>
          <p className="text-xs text-text-bright/50 dark:text-text-dark/50 truncate">
            {typingLabel
              ? typingLabel
              : room.type === "group"
              ? `${memberCount} members`
              : isOnline
              ? "Online"
              : "Offline"}
          </p>
        </div>
      </div>
      <IconButton onClick={onToggleDrawer} aria-label="Toggle info panel">
        <SidebarIcon className="w-5 h-5" />
      </IconButton>
    </div>
  );
}
