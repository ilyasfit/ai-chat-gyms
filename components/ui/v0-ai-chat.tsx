"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react"; // Added ArrowDownIcon
import { TextShimmer } from "@/components/ui/text-shimmer";
import { ResponseStream } from "@/components/ui/response-stream";
import { useAutoScroll } from "@/hooks/use-auto-scroll"; // Added useAutoScroll import

// --- Types ---
export interface Message {
  // Added export
  id: string;
  role: "user" | "assistant";
  content: string | AsyncIterable<string>; // Allow AsyncIterable for content
}

// --- Hooks ---
interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

// --- Chat Input Component (Restored Original Structure/Style) ---
interface ChatInputProps {
  onSendMessage: (message: string) => void; // Pass the message content up
  isLoading: boolean;
}

// --- Main Chat Component (New Wrapper) ---
interface V0AIChatProps {
  messages: Message[];
  isLoading: boolean;
  currentShimmerText: string;
  onSendMessage: (message: string) => void;
}

export function V0AIChat({
  messages,
  isLoading,
  currentShimmerText,
  onSendMessage,
}: V0AIChatProps) {
  // Lift useAutoScroll hook to the parent component
  const { scrollRef, isAtBottom, scrollToBottom } = useAutoScroll({
    content: messages.length, // Use message count to trigger scroll logic
    smooth: true,
  });

  // Callback to handle sending and then scrolling
  const handleSendMessageAndScroll = (message: string) => {
    onSendMessage(message);
    // Scroll after a short delay to allow the message to render
    setTimeout(() => scrollToBottom(), 50);
  };

  return (
    // Use theme variable for background
    <div className="flex flex-col h-screen bg-background">
      {" "}
      {/* Main container */}
      <AIChatMessages
        messages={messages}
        isLoading={isLoading}
        currentShimmerText={currentShimmerText}
        // Pass down scroll props
        scrollRef={scrollRef}
        isAtBottom={isAtBottom}
        scrollToBottom={scrollToBottom}
      />
      {/* Input area wrapper: Removed padding and border, added flex centering, ADDED bottom padding */}
      <div className="flex justify-center pb-4">
        {" "}
        {/* Added pb-4 */}
        <ChatInput
          onSendMessage={handleSendMessageAndScroll} // Use the combined handler
          isLoading={isLoading}
          // Removed unnecessary scrollToBottom prop pass-down
        />
      </div>
    </div>
  );
}

// --- Chat Input Component (No structural changes needed here for layout) ---
interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  // Removed unused scrollToBottom prop
}

function ChatInput({
  onSendMessage,
  isLoading,
}: // Removed unused scrollToBottom prop
ChatInputProps) {
  // Changed export to function
  const [value, setValue] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });

  const handleSend = () => {
    const trimmedValue = value.trim();
    if (trimmedValue && !isLoading) {
      onSendMessage(trimmedValue); // This now also triggers scroll via handleSendMessageAndScroll
      setValue("");
      adjustHeight(true);
      // No need to call scrollToBottom directly here, it's handled in the parent
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    // Container matching original width behavior
    <div className="w-full max-w-2xl">
      {/* Use bg-card for background, remove gradient */}
      <div
        className="relative rounded-xl border border-border bg-card" // Added bg-card
        // Removed style attribute for gradient
      >
        <div className="overflow-y-auto">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask Safya a question..." // Updated placeholder
            className={cn(
              "w-full px-4 py-3", // Adjusted padding (removed pl-12)
              "resize-none",
              "bg-transparent",
              "border-none",
              "text-foreground text-sm", // Use theme variable
              "focus:outline-none",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-muted-foreground placeholder:text-sm", // Use theme variable
              "min-h-[60px]"
            )}
            style={{
              overflow: "hidden",
            }}
            disabled={isLoading} // Disable textarea when loading
          />
          {/* Removed Attach Button */}
        </div>

        <div className="flex items-center justify-end p-3">
          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            className={cn(
              "p-2 rounded-lg transition-colors flex items-center justify-center",
              // Use theme variables for button states
              value.trim() && !isLoading
                ? "bg-primary text-primary-foreground hover:bg-primary/90" // Active state
                : "bg-muted text-muted-foreground cursor-not-allowed" // Inactive/disabled state
            )}
            disabled={!value.trim() || isLoading}
          >
            <ArrowUpIcon className="w-5 h-5" />
            <span className="sr-only">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Chat Messages Component ---
interface AIChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  currentShimmerText: string;
  // Add props for scroll state and control, adjust scrollRef type
  scrollRef: React.RefObject<HTMLDivElement | null>; // Allow null
  isAtBottom: boolean;
  scrollToBottom: () => void;
}

function AIChatMessages({
  // Changed export to function
  messages,
  isLoading,
  currentShimmerText,
  // Receive scroll props
  scrollRef,
  isAtBottom,
  scrollToBottom,
}: AIChatMessagesProps) {
  // Removed internal useAutoScroll hook call

  return (
    // Assign scrollRef, make scroll area full width, DOUBLE the spacing, ADD bottom padding
    <div
      ref={scrollRef}
      // Added pb-24 (adjust as needed) to create space below messages
      className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 relative pb-24"
    >
      {/* Add a container inside the map to center messages */}
      {messages.map((message) => (
        <div
          key={message.id}
          // Apply centering and max-width HERE
          className={cn(
            "flex w-full max-w-2xl mx-auto", // Centering container
            message.role === "user" ? "justify-end" : "justify-start"
          )}
        >
          {/* Original message content div */}
          <div
            className={cn(
              "rounded-lg px-4 py-2",
              // User gets bg and border, Assistant is transparent and full-width
              message.role === "user"
                ? "bg-white dark:bg-card text-foreground max-w-[90%] border border-border" // User: Added border
                : "text-foreground" // Assistant: Removed max-width
            )}
          >
            {message.role === "assistant" ? (
              // Apply prose classes here to style the markdown output from ResponseStream
              // Removed base 'prose' class to potentially reduce spacing, kept 'prose-sm'
              <div className="prose-sm dark:prose-invert max-w-none">
                <ResponseStream
                  // Pass content directly, ResponseStream handles string or iterable
                  textStream={message.content}
                  className="whitespace-pre-wrap" // Keep whitespace handling
                />
              </div>
            ) : (
              // User message content will always be string here
              <p className="whitespace-pre-wrap">{message.content as string}</p>
            )}
          </div>
        </div>
      ))}
      {/* Loading Indicator */}
      {isLoading && (
        // Wrap loading indicator in the same centering container as messages
        <div className="flex w-full max-w-2xl mx-auto justify-start">
          {/* Use theme variable for loading text */}
          <div className="rounded-lg px-4 py-2 text-muted-foreground">
            {" "}
            {/* Removed w-full */}
            <TextShimmer>{currentShimmerText}</TextShimmer>
          </div>
        </div>
      )}
      {/* Removed messagesEndRef div */}

      {/* Scroll to Bottom Button */}
      {/* Scroll to Bottom Button: Changed to fixed positioning */}
      {!isAtBottom && (
        <button
          onClick={() => scrollToBottom()} // Call hook's function
          // Use theme variables for scroll-to-bottom button
          className="fixed bottom-20 right-8 p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors z-50 shadow-lg"
          aria-label="Scroll to bottom"
        >
          <ArrowDownIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
