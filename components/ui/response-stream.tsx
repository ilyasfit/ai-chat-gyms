"use client";

import React, { useEffect, useState, useRef } from "react";
import { MarkdownRenderer } from "./markdown-renderer"; // Keep MarkdownRenderer

export type ResponseStreamProps = {
  textStream: string | AsyncIterable<string>;
  className?: string;
  onComplete?: () => void; // Keep onComplete if needed
  as?: keyof React.JSX.IntrinsicElements; // Keep 'as' prop
  onError?: (error: unknown) => void; // Keep onError
};

// Simplified ResponseStream component
function ResponseStream({
  textStream,
  className = "",
  onComplete,
  as = "div",
  onError,
}: ResponseStreamProps) {
  const [displayedText, setDisplayedText] = useState("");
  // Removed isComplete state
  const streamEndedRef = useRef(false); // Ref to prevent multiple onComplete calls

  useEffect(() => {
    // Reset state when textStream changes
    setDisplayedText("");
    // Removed setIsComplete(false)
    streamEndedRef.current = false;
    let accumulated = ""; // Accumulate text locally within the effect
    let isActive = true; // Flag to prevent state updates after unmount or stream change

    const processStream = async () => {
      if (typeof textStream === "string") {
        // Handle static string input
        setDisplayedText(textStream);
        // Removed setIsComplete(true)
        if (!streamEndedRef.current) {
          onComplete?.();
          streamEndedRef.current = true;
        }
      } else if (
        textStream &&
        typeof textStream[Symbol.asyncIterator] === "function"
      ) {
        // Handle AsyncIterable stream input
        try {
          for await (const chunk of textStream) {
            if (!isActive) return; // Stop processing if component unmounted or stream changed
            accumulated += chunk;
            setDisplayedText(accumulated); // Update state with accumulated text
          }
          if (isActive) {
            // Removed setIsComplete(true)
            if (!streamEndedRef.current) {
              onComplete?.();
              streamEndedRef.current = true;
            }
          }
        } catch (error) {
          console.error("Error processing text stream:", error);
          if (isActive) {
            setDisplayedText(accumulated + "\n\nError reading stream."); // Show error in UI
            // Removed setIsComplete(true)
            if (!streamEndedRef.current) {
              onError?.(error); // Call onError callback
              onComplete?.(); // Still call onComplete if defined
              streamEndedRef.current = true;
            }
          }
        }
      }
    };

    processStream();

    // Cleanup function
    return () => {
      isActive = false; // Mark as inactive on unmount or stream change
    };
  }, [textStream, onComplete, onError]); // Rerun effect if textStream, onComplete, or onError changes

  const Container = as; // Use the 'as' prop for the container element

  return (
    <Container className={className}>
      {/* Render the incrementally updated text using MarkdownRenderer */}
      <MarkdownRenderer content={displayedText} />
    </Container>
  );
}

// Export the simplified component
export { ResponseStream };

// Note: useTextStream hook is removed as it's no longer needed.
// Mode, speed, fadeDuration, segmentDelay, characterChunkSize props are removed.
