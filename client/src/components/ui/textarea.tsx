import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, style, ...props }, ref) => {
  return (
    <textarea
      style={{
        cursor: "text",
        caretColor: '#000000',
        WebkitTextFillColor: '#333333',
        color: '#333333',
        ...style
      }}
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm caret-primary cursor-text",
        className
      )}
      ref={(el) => {
        if (el) {
          // Force styles using setProperty with important flag
          el.style.setProperty('caret-color', '#000000', 'important');
          el.style.setProperty('color', '#333333', 'important');
          el.style.setProperty('-webkit-text-fill-color', '#333333', 'important');
          el.style.setProperty('-webkit-caret-color', '#000000', 'important');
          el.style.setProperty('-moz-caret-color', '#000000', 'important');
        }
        // Call the forwarded ref
        if (typeof ref === 'function') {
          ref(el);
        } else if (ref) {
          ref.current = el;
        }
      }}
      onFocus={(e) => {
        const target = e.target as HTMLTextAreaElement;
        target.style.setProperty('caret-color', '#000000', 'important');
        target.style.setProperty('color', '#333333', 'important');
        target.style.setProperty('-webkit-text-fill-color', '#333333', 'important');
        target.style.setProperty('-webkit-caret-color', '#000000', 'important');
        target.style.setProperty('-moz-caret-color', '#000000', 'important');
        // Call original onFocus if provided
        if (props.onFocus) {
          props.onFocus(e);
        }
      }}
      onInput={(e) => {
        const target = e.target as HTMLTextAreaElement;
        target.style.setProperty('caret-color', '#000000', 'important');
        target.style.setProperty('color', '#333333', 'important');
        target.style.setProperty('-webkit-text-fill-color', '#333333', 'important');
        target.style.setProperty('-webkit-caret-color', '#000000', 'important');
        target.style.setProperty('-moz-caret-color', '#000000', 'important');
        // Call original onInput if provided
        if (props.onInput) {
          props.onInput(e);
        }
      }}
      onClick={(e) => {
        const target = e.target as HTMLTextAreaElement;
        target.style.setProperty('caret-color', '#000000', 'important');
        target.style.setProperty('color', '#333333', 'important');
        target.style.setProperty('-webkit-text-fill-color', '#333333', 'important');
        target.style.setProperty('-webkit-caret-color', '#000000', 'important');
        target.style.setProperty('-moz-caret-color', '#000000', 'important');
        // Call original onClick if provided
        if (props.onClick) {
          props.onClick(e);
        }
      }}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
