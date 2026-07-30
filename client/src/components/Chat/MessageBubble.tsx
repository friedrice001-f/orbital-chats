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

export function MessageBubble({
  message,
  isOwn,
  senderName,
  showSenderName,
  onImageClick,
}: MessageBubbleProps) {
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

        {message.image && (
          <button
            onClick={() => onImageClick(message.image!.dataUrl)}
            className="block mb-1.5 rounded-lg overflow-hidden max-w-[240px]"
          >
            <img
              src={message.image.dataUrl}
              alt={message.image.name}
              className="w-full h-auto object-cover hover:opacity-90 transition"
            />
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
