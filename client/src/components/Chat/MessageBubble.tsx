import { motion } from "framer-motion";
import clsx from "clsx";
import type { ChatMessage } from "../../types";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  senderName?: string;
  showSenderName?: boolean;
  onImageClick: (src: string) => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

async function downloadAll(images: { dataUrl: string; name?: string }[]) {
  for (let i = 0; i < images.length; i++) {
    const a = document.createElement("a");
    a.href = images[i].dataUrl;
    a.download = images[i].name || `image-${i + 1}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // small gap so the browser doesn't drop back-to-back downloads
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

export function MessageBubble({
  message,
  isOwn,
  senderName,
  showSenderName,
  onImageClick,
}: MessageBubbleProps) {
  // New messages carry `images`; older messages only have a single `image`.
  const images =
    message.images && message.images.length > 0
      ? message.images
      : message.image
      ? [message.image]
      : [];
  const isGrid = images.length > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={clsx("flex w-full mb-2", isOwn ? "justify-end" : "justify-start")}
    >
      <div
        className={clsx(
          "max-w-[72%] rounded-2xl px-4 py-2.5 shadow-sm",
          isOwn
            ? "bg-bubble-sender-bright dark:bg-bubble-sender-dark dark:shadow-glow-violet rounded-br-md"
            : "bg-bubble-receiver-bright dark:bg-bubble-receiver-dark rounded-bl-md"
        )}
      >
        {showSenderName && !isOwn && senderName && (
          <p className="text-xs font-semibold text-glow-violet mb-1">{senderName}</p>
        )}

        {images.length > 0 && (
          <div
            className={clsx(
              "mb-1.5 gap-1",
              isGrid ? "grid grid-cols-2 max-w-[280px]" : "max-w-[240px]"
            )}
          >
            {images.map((img, index) => (
              <div
                key={`${img.name}-${index}`}
                className={clsx(
                  "relative rounded-lg overflow-hidden",
                  // With 3 photos, let the first one span the full width
                  isGrid && images.length === 3 && index === 0 && "col-span-2"
                )}
              >
                <button onClick={() => onImageClick(img.dataUrl)} className="block w-full">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className={clsx(
                      "w-full object-cover hover:opacity-90 transition",
                      isGrid ? "aspect-square" : "h-auto"
                    )}
                  />
                </button>

                <a
                  href={img.dataUrl}
                  download={img.name || "image"}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Download image"
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 transition flex items-center justify-center text-white"
                >
                  <DownloadIcon className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}

        {isGrid && (
          <button
            onClick={() => downloadAll(images)}
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-glow-violet hover:opacity-80 transition"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            Download all ({images.length})
          </button>
        )}

        {message.text && (
          <p className="text-sm leading-relaxed text-text-bright dark:text-text-dark whitespace-pre-wrap break-words">
            {message.text}
          </p>
        )}

        <p
          className={clsx(
            "text-[10px] mt-1 text-text-bright/40 dark:text-text-dark/40",
            isOwn ? "text-right" : "text-left"
          )}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </motion.div>
  );
}