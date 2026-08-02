import { Avatar } from "../common/Avatar";
import { IconButton } from "../common/IconButton";
import { BackIcon, SidebarIcon, PhoneIcon } from "../common/Icons";
import { useChat } from "../../context/ChatContext";
import { useCall } from "../../context/CallContext";
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
  const { currentUser } = useChat();
  const { startCall, status } = useCall();

  const peerId =
    room.type === "dm" && currentUser
      ? room.memberIds.find((id) => id !== currentUser.id)
      : null;

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
      <div className="flex items-center gap-1">
        {peerId && (
          <>
            <IconButton
              onClick={() => startCall(peerId, room.name, "voice")}
              disabled={status !== "idle"}
              aria-label="Start voice call"
            >
              <PhoneIcon className="w-5 h-5" />
            </IconButton>
            <IconButton
              onClick={() => startCall(peerId, room.name, "video")}
              disabled={status !== "idle"}
              aria-label="Start video call"
            >
              <span className="w-5 h-5 flex items-center justify-center text-base leading-none">
                🎥
              </span>
            </IconButton>
          </>
        )}
        <IconButton onClick={onToggleDrawer} aria-label="Toggle info panel">
          <SidebarIcon className="w-5 h-5" />
        </IconButton>
      </div>
    </div>
  );
}