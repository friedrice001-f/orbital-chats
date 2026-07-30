import { useMemo, useState } from "react";
import clsx from "clsx";
import { OrbitalWheel } from "../OrbitalWheel/OrbitalWheel";
import { ChatWindow } from "../Chat/ChatWindow";
import { ContextDrawer } from "../Drawer/ContextDrawer";
import { useChat } from "../../context/ChatContext";

export function AppShell() {
  const { rooms, activeRoomId, selectRoom } = useChat();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) || null,
    [rooms, activeRoomId]
  );

  // On mobile, showing a chat replaces the wheel entirely (single-panel
  // flow); "back" clears the active room to return to the wheel view.
  const mobileShowingChat = !!activeRoom;

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-surface-bright dark:bg-surface-dark">
      {/* Panel 1 — Orbital Wheel (30% desktop width) */}
      <div
        className={clsx(
          "w-full md:w-[30%] md:min-w-[280px] md:max-w-[380px] h-full shrink-0",
          mobileShowingChat && "hidden md:block"
        )}
      >
        <OrbitalWheel />
      </div>

      {/* Panel 2 — Active chat (70% desktop width) */}
      <div
        className={clsx(
          "w-full md:flex-1 h-full",
          !mobileShowingChat && "hidden md:flex"
        )}
      >
        <ChatWindow
          room={activeRoom}
          onBack={() => selectRoom("")}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
        />
      </div>

      {/* Panel 3 — Context drawer (togglable) */}
      <ContextDrawer room={activeRoom} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
