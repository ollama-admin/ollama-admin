"use client";

import { cn } from "@/lib/cn";

/** Animated typing dots indicator for chat streaming. */
function TypingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)} aria-label="Typing">
      <span className="h-2 w-2 animate-bounce rounded-full bg-[hsl(var(--muted-foreground))] [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[hsl(var(--muted-foreground))] [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[hsl(var(--muted-foreground))] [animation-delay:300ms]" />
    </div>
  );
}

export { TypingIndicator };
