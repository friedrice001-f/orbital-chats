import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { IconButton } from "../common/IconButton";
import { CloseIcon, PaperclipIcon, SendIcon } from "../common/Icons";
import type { ImagePayload } from "../../types";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB per image
const MAX_IMAGES = 10; // per message
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20MB per message

interface MessageInputProps {
  onSend: (text: string, images?: ImagePayload[] | null) => void;
  onTyping: (isTyping: boolean) => void;
}

function readAsImagePayload(file: File): Promise<ImagePayload & { size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        dataUrl: reader.result as string,
        name: file.name,
        mime: file.type,
        size: file.size,
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function MessageInput({ onSend, onTyping }: MessageInputProps) {
  const [text, setText] = useState("");
  const [pendingImages, setPendingImages] = useState<(ImagePayload & { size: number })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  function handleChangeText(value: string) {
    setText(value);
    onTyping(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => onTyping(false), 1500);
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    let currentCount = pendingImages.length;
    let currentBytes = pendingImages.reduce((sum, img) => sum + img.size, 0);
    const accepted: File[] = [];
    const problems: string[] = [];

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        problems.push(`${file.name}: only PNG, JPG, and WEBP are supported`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        problems.push(`${file.name}: larger than 5MB`);
        continue;
      }
      if (currentCount >= MAX_IMAGES) {
        problems.push(`Only ${MAX_IMAGES} photos per message`);
        break;
      }
      if (currentBytes + file.size > MAX_TOTAL_BYTES) {
        problems.push("Total size is over 20MB, send the rest in another message");
        break;
      }
      accepted.push(file);
      currentCount += 1;
      currentBytes += file.size;
    }

    setError(problems.length > 0 ? problems.join(". ") + "." : null);
    if (accepted.length === 0) return;

    try {
      const loaded = await Promise.all(accepted.map(readAsImagePayload));
      setPendingImages((prev) => [...prev, ...loaded]);
    } catch {
      setError("Could not read one of the selected images.");
    }
  }

  function removeImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && pendingImages.length === 0) return;
    const images: ImagePayload[] = pendingImages.map(({ dataUrl, name, mime }) => ({
      dataUrl,
      name,
      mime,
    }));
    onSend(trimmed, images.length > 0 ? images : null);
    setText("");
    setPendingImages([]);
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

      {pendingImages.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingImages.map((img, index) => (
            <div
              key={`${img.name}-${index}`}
              className="relative w-16 h-16 rounded-lg overflow-hidden bg-black/5 dark:bg-white/10"
            >
              <img
                src={img.dataUrl}
                alt={img.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center bg-black/60 text-white hover:bg-black/80"
                aria-label={`Remove ${img.name}`}
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <IconButton onClick={() => fileInputRef.current?.click()} aria-label="Attach images">
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