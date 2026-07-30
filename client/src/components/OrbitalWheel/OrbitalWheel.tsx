import { useMemo, useState } from "react";
import { useOrbitalWheel } from "../../hooks/useOrbitalWheel";
import { OrbitNode } from "./OrbitNode";
import { IconButton } from "../common/IconButton";
import { Avatar } from "../common/Avatar";
import { LogoutIcon, MoonIcon, PlusIcon, SunIcon } from "../common/Icons";
import { useTheme } from "../../context/ThemeContext";
import { useChat } from "../../context/ChatContext";
import { NewGroupModal } from "../Modals/NewGroupModal";

export interface WheelItem {
  id: string;
  name: string;
  online?: boolean;
  isPeer?: boolean; // true = not-yet-opened online user, false/undefined = existing room
}

export function OrbitalWheel() {
  const { mode, toggleMode } = useTheme();
  const { currentUser, rooms, onlineUsers, unreadRoomIds, activeRoomId, selectRoom, openDm, logout } =
    useChat();
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  // Combine existing rooms with online peers who don't have a room yet,
  // so a brand-new contact still shows up on the wheel to start a DM.
  const items = useMemo<WheelItem[]>(() => {
    const roomItems: WheelItem[] = rooms.map((r) => ({
      id: r.id,
      name: r.name,
      online:
        r.type === "dm"
          ? onlineUsers.some((u) => r.memberIds.includes(u.id))
          : undefined,
    }));

    const roomedPeerIds = new Set(
      rooms.filter((r) => r.type === "dm").flatMap((r) => r.memberIds)
    );
    const newPeers: WheelItem[] = onlineUsers
      .filter((u) => !roomedPeerIds.has(u.id))
      .map((u) => ({ id: u.id, name: u.displayName, online: true, isPeer: true }));

    return [...roomItems, ...newPeers];
  }, [rooms, onlineUsers]);

  const { layouts, handlers, goTo, activeIndex } = useOrbitalWheel({
    itemCount: items.length,
  });

  function handleSelect(index: number, item: WheelItem) {
    goTo(index);
    if (item.isPeer) {
      openDm(item.id);
    } else {
      selectRoom(item.id);
    }
  }

  return (
    <aside className="relative h-full flex flex-col bg-surface-bright-soft dark:bg-surface-dark border-r border-black/5 dark:border-white/5">
      {/* Top controls */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-glow-cyan to-glow-violet flex items-center justify-center text-xs font-bold text-slate-900">
            OC
          </div>
          <span className="font-semibold text-text-bright dark:text-text-dark">Orbital</span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton onClick={() => setGroupModalOpen(true)} aria-label="New group">
            <PlusIcon className="w-5 h-5" />
          </IconButton>
          <IconButton onClick={toggleMode} aria-label="Toggle theme">
            {mode === "dark" ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </IconButton>
        </div>
      </div>

      {/* The orbital wheel track */}
      <div
        className="relative flex-1 orbit-fade-mask overflow-hidden touch-none cursor-grab active:cursor-grabbing"
        onWheel={handlers.onWheel}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerLeave={handlers.onPointerUp}
      >
        {items.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-center text-sm text-text-bright/40 dark:text-text-dark/40 px-6">
            No conversations yet. Waiting for other users to come online…
          </p>
        )}
        {layouts.map((layout, i) => {
          const item = items[i];
          if (!item) return null;
          return (
            <OrbitNode
              key={item.id}
              layout={layout}
              name={item.name}
              online={item.online}
              hasUnread={unreadRoomIds.has(item.id)}
              onSelect={() => handleSelect(i, item)}
            />
          );
        })}
      </div>

      {/* Current user footer */}
      {currentUser && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={currentUser.displayName} online showStatus={false} size={36} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate text-text-bright dark:text-text-dark">
                {currentUser.displayName}
              </p>
              <p className="text-xs text-text-bright/50 dark:text-text-dark/50 truncate">
                {currentUser.phone}
              </p>
            </div>
          </div>
          <IconButton onClick={logout} aria-label="Log out">
            <LogoutIcon className="w-[18px] h-[18px]" />
          </IconButton>
        </div>
      )}

      {groupModalOpen && <NewGroupModal onClose={() => setGroupModalOpen(false)} />}

      {/* Keep activeIndex referenced so it's easy to hook up keyboard nav later */}
      <span className="sr-only">{activeRoomId}{activeIndex}</span>
    </aside>
  );
}
