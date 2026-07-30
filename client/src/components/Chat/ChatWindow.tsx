import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChatHeader } from "./ChatHeader";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { Lightbox } from "./Lightbox";
import { EmptyState } from "./EmptyState";
import { useChat } from "../../context/ChatContext";
import { useTheme } from "../../context/ThemeContext";
import type { ImagePayload, RoomSummary } from "../../types";

interface ChatWindowProps {
  room: RoomSummary | null;
  onBack?: () => void;
  onToggleDrawer: () => void;
}

export function ChatWindow({ room, onBack, onToggleDrawer }: ChatWindowProps) {
  const { currentUser, messagesByRoom, onlineUsers, sendMessage, setTyping, typingByRoom } =
    useChat();
  const { wallpaper, mode } = useTheme();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = room ? messagesByRoom[room.id] || [] : [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, room?.id]);

  const otherMemberOnline = useMemo(() => {
    if (!room || room.type !== "dm" || !currentUser) return false;
    const otherId = room.memberIds.find((id) => id !== currentUser.id);
    return onlineUsers.some((u) => u.id === otherId);
  }, [room, onlineUsers, currentUser]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    onlineUsers.forEach((u) => map.set(u.id, u.displayName));
    if (currentUser) map.set(currentUser.id, currentUser.displayName);
    return map;
  }, [onlineUsers, currentUser]);

  if (!room || !currentUser) return <EmptyState />;

  const typingNames = typingByRoom[room.id] || [];
  const typingLabel =
    typingNames.length > 0 ? `${typingNames.join(", ")} typing…` : null;

  function handleSend(text: string, image?: ImagePayload | null) {
    sendMessage(room!.id, text, image);
  }

  // Wallpaper sits behind the message stream via inline style (must be
  // inline since it's a runtime, user-uploaded data URL). A translucent
  // overlay (color depends on theme) keeps bubble text legible on top of
  // busy images.
  const wallpaperStyle: CSSProperties = wallpaper
    ? {
        backgroundImage: `url(${wallpaper})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {};

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      <ChatHeader
        room={room}
        isOnline={otherMemberOnline}
        memberCount={room.memberIds.length}
        typingLabel={typingLabel}
        onBack={onBack}
        onToggleDrawer={onToggleDrawer}
      />

      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0" style={wallpaperStyle} />
        <div
          className={
            mode === "dark"
              ? "absolute inset-0 bg-surface-dark/75"
              : "absolute inset-0 bg-white/60"
          }
        />
        <div
          ref={scrollRef}
          className="relative h-full overflow-y-auto thin-scrollbar px-4 sm:px-6 py-4"
        >
          {messages.length === 0 ? (
            <p className="text-center text-sm text-text-bright/40 dark:text-text-dark/40 mt-10">
              No messages yet — say hello 👋
            </p>
          ) : (
            messages.map((message, idx) => {
              const isOwn = message.senderId === currentUser.id;
              const prev = messages[idx - 1];
              const showSenderName =
                room.type === "group" && (!prev || prev.senderId !== message.senderId);
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={isOwn}
                  senderName={nameById.get(message.senderId)}
                  showSenderName={showSenderName}
                  onImageClick={setLightboxSrc}
                />
              );
            })
          )}
        </div>
      </div>

      <MessageInput onSend={handleSend} onTyping={(t) => setTyping(room.id, t)} />

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
