import { useMemo, useRef, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "../common/Avatar";
import { CloseIcon, ImageIcon } from "../common/Icons";
import { useChat } from "../../context/ChatContext";
import { useTheme } from "../../context/ThemeContext";
import type { RoomSummary } from "../../types";

interface ContextDrawerProps {
  room: RoomSummary | null;
  open: boolean;
  onClose: () => void;
}

const MAX_WALLPAPER_BYTES = 6 * 1024 * 1024;

export function ContextDrawer({ room, open, onClose }: ContextDrawerProps) {
  const { currentUser, onlineUsers, messagesByRoom } = useChat();
  const { wallpaper, setWallpaper } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const members = useMemo(() => {
    if (!room) return [];
    return room.memberIds.map((id) => {
      if (id === currentUser?.id) return currentUser;
      return onlineUsers.find((u) => u.id === id) || { id, displayName: "Offline user", phone: "", online: false };
    });
  }, [room, onlineUsers, currentUser]);

  const sharedImages = useMemo(() => {
    if (!room) return [];
    return (messagesByRoom[room.id] || [])
      .filter((m) => m.image)
      .map((m) => m.image!.dataUrl);
  }, [room, messagesByRoom]);

  function handleWallpaperFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_WALLPAPER_BYTES) {
      alert("Please choose an image under 6MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setWallpaper(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-30 lg:hidden"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed lg:static right-0 top-0 h-full w-[320px] z-40 bg-surface-bright dark:bg-surface-dark-soft border-l border-black/5 dark:border-white/10 flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/10">
              <h2 className="font-semibold text-text-bright dark:text-text-dark">Details</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Close panel"
              >
                <CloseIcon className="w-[18px] h-[18px]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto thin-scrollbar px-5 py-4 space-y-6">
              {room && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-bright/40 dark:text-text-dark/40 mb-3">
                    {room.type === "group" ? `Members (${members.length})` : "Participant"}
                  </h3>
                  <div className="space-y-2">
                    {members.map((m) =>
                      m ? (
                        <div key={m.id} className="flex items-center gap-3">
                          <Avatar name={m.displayName} online={m.online} size={34} />
                          <span className="text-sm text-text-bright dark:text-text-dark">
                            {m.displayName}
                          </span>
                        </div>
                      ) : null
                    )}
                  </div>
                </section>
              )}

              {room && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-bright/40 dark:text-text-dark/40 mb-3">
                    Shared media
                  </h3>
                  {sharedImages.length === 0 ? (
                    <p className="text-sm text-text-bright/40 dark:text-text-dark/40 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> No images shared yet
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      {sharedImages.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          className="w-full h-20 object-cover rounded-md"
                          alt="Shared media"
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-bright/40 dark:text-text-dark/40 mb-3">
                  Chat wallpaper
                </h3>
                {wallpaper && (
                  <img
                    src={wallpaper}
                    className="w-full h-24 object-cover rounded-lg mb-2.5"
                    alt="Current wallpaper"
                  />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleWallpaperFile}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 text-sm rounded-lg bg-black/5 dark:bg-white/10 py-2 text-text-bright dark:text-text-dark hover:bg-black/10 dark:hover:bg-white/20 transition"
                  >
                    Upload from device
                  </button>
                  {wallpaper && (
                    <button
                      onClick={() => setWallpaper(null)}
                      className="text-sm rounded-lg px-3 py-2 text-rose-500 hover:bg-rose-500/10 transition"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-text-bright/40 dark:text-text-dark/40 mt-2">
                  Applies to your view of every chat, stored locally on this device.
                </p>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
