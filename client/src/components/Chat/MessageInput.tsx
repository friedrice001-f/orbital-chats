import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { IconButton } from "../common/IconButton";
import { CloseIcon, PaperclipIcon, SendIcon } from "../common/Icons";
import type { ImagePayload } from "../../types";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — demo-scale guard

interface MessageInputProps {
  onSend: (text: string, image?: ImagePayload | null) => void;
  onTyping: (isTyping: boolean) => void;
}

export function MessageInput({ onSend, onTyping }: MessageInputProps) {
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<ImagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  function handleChangeText(value: string) {
    setText(value);
    onTyping(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => onTyping(false), 1500);
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Only PNG, JPG, and WEBP images are supported.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image must be smaller than 5MB.");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage({
        dataUrl: reader.result as string,
        name: file.name,
        mime: file.type,
      });
    };
    reader.readAsDataURL(file);
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && !pendingImage) return;
    onSend(trimmed, pendingImage);
    setText("");
    setPendingImage(null);
    onTyping(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-black/5 dark:border-white/5 bg-surface-bright dark:bg-surface-dark-soft px-4 py-3">
      {error && (
        <p className="text-xs text-rose-500 mb-2">
          {error}{" "}
          <button className="underline" onClick={() => setError(null)}>
            dismiss
          </button>
        </p>
      )}

      {pendingImage && (
        <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-black/5 dark:bg-white/10 p-1.5 pr-2">
          <img
            src={pendingImage.dataUrl}
            alt={pendingImage.name}
            className="w-12 h-12 object-cover rounded-md"
          />
          <span className="text-xs text-text-bright/70 dark:text-text-dark/70 max-w-[140px] truncate">
            {pendingImage.name}
          </span>
          <button
            onClick={() => setPendingImage(null)}
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="Remove attachment"
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
        <IconButton onClick={() => fileInputRef.current?.click()} aria-label="Attach image">
          <PaperclipIcon className="w-5 h-5" />
        </IconButton>

        <textarea
          value={text}
          onChange={(e) => handleChangeText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 resize-none max-h-32 rounded-2xl bg-black/5 dark:bg-white/5 px-4 py-2.5 text-sm text-text-bright dark:text-text-dark placeholder:text-text-bright/40 dark:placeholder:text-text-dark/40 outline-none focus:ring-2 focus:ring-glow-cyan/40"
        />

        <IconButton
          onClick={handleSend}
          className="bg-gradient-to-br from-glow-cyan to-glow-violet text-slate-900 hover:opacity-90"
          aria-label="Send message"
        >
          <SendIcon className="w-[18px] h-[18px]" />
        </IconButton>
      </div>
    </div>
  );
}
