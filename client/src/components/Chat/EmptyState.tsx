export function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-surface-bright-soft dark:bg-surface-dark text-center px-6">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-glow-cyan/30 to-glow-violet/30 flex items-center justify-center text-2xl">
        💬
      </div>
      <p className="text-text-bright/60 dark:text-text-dark/60 max-w-xs text-sm">
        Select a conversation from the wheel, or scroll to find someone online
        to start chatting.
      </p>
    </div>
  );
}
