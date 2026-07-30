import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, active, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={clsx(
          "inline-flex items-center justify-center rounded-full transition-colors duration-150",
          "w-10 h-10 text-text-bright/70 dark:text-text-dark/70",
          "hover:bg-black/5 dark:hover:bg-white/10",
          active && "bg-black/5 dark:bg-white/10 text-text-bright dark:text-text-dark",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";
