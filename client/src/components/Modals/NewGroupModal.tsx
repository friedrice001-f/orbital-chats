import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "../../context/ChatContext";
import { Avatar } from "../common/Avatar";
import { CheckIcon, CloseIcon } from "../common/Icons";
import clsx from "clsx";

interface NewGroupModalProps {
  onClose: () => void;
}

export function NewGroupModal({ onClose }: NewGroupModalProps) {
  const { onlineUsers, createGroup } = useChat();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (selected.size === 0 || !name.trim()) return;
    setSubmitting(true);
    await createGroup(name.trim(), [...selected]);
    setSubmitting(false);
    onClose();
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-2xl bg-surface-bright dark:bg-surface-dark-soft border border-black/5 dark:border-white/10 shadow-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-text-bright dark:text-text-dark">New Group</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close"
            >
              <CloseIcon className="w-[18px] h-[18px]" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-black/5 dark:bg-white/5 px-3.5 py-2.5 text-sm text-text-bright dark:text-text-dark placeholder:text-text-bright/40 dark:placeholder:text-text-dark/40 outline-none focus:ring-2 focus:ring-glow-cyan/40 mb-4"
          />

          <p className="text-xs font-medium text-text-bright/50 dark:text-text-dark/50 mb-2">
            Add online members
          </p>
          <div className="max-h-56 overflow-y-auto thin-scrollbar space-y-1 mb-4">
            {onlineUsers.length === 0 && (
              <p className="text-sm text-text-bright/40 dark:text-text-dark/40 py-4 text-center">
                No one else is online right now.
              </p>
            )}
            {onlineUsers.map((u) => {
              const isSelected = selected.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u.id)}
                  className={clsx(
                    "w-full flex items-center gap-3 rounded-lg px-2 py-2 transition",
                    isSelected ? "bg-glow-cyan/10" : "hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                >
                  <Avatar name={u.displayName} online size={34} showStatus={false} />
                  <span className="flex-1 text-left text-sm text-text-bright dark:text-text-dark">
                    {u.displayName}
                  </span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-glow-cyan flex items-center justify-center">
                      <CheckIcon className="w-3.5 h-3.5 text-slate-900" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleCreate}
            disabled={selected.size === 0 || !name.trim() || submitting}
            className="w-full rounded-lg bg-gradient-to-r from-glow-cyan to-glow-violet py-2.5 font-semibold text-slate-900 disabled:opacity-40 transition hover:opacity-90"
          >
            {submitting ? "Creating…" : `Create group (${selected.size} selected)`}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
