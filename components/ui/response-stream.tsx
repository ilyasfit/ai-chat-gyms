"use client";

// Removed unused 'cn' import
import React, { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownRenderer } from "./markdown-renderer"; // Import the new component (using named import)

export type Mode = "typewriter" | "fade"; // Note: 'fade' mode is now effectively rendered like 'typewriter' via MarkdownRenderer

export type UseTextStreamOptions = {
  textStream: string | AsyncIterable<string>;
  speed?: number;
  mode?: Mode;
  onComplete?: () => void;
  fadeDuration?: number;
  segmentDelay?: number;
  characterChunkSize?: number;
  onError?: (error: unknown) => void;
};

export type UseTextStreamResult = {
  displayedText: string;
  isComplete: boolean;
  segments: { text: string; index: number }[];
  getFadeDuration: () => number;
  getSegmentDelay: () => number;
  reset: () => void;
  startStreaming: () => void;
  pause: () => void;
  resume: () => void;
};

function useTextStream({
  textStream,
  speed = 20,
  mode = "typewriter",
  onComplete,
  fadeDuration,
  segmentDelay,
  characterChunkSize,
  onError,
}: UseTextStreamOptions): UseTextStreamResult {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [segments, setSegments] = useState<{ text: string; index: number }[]>(
    []
  );

  const speedRef = useRef(speed);
  const modeRef = useRef(mode);
  const currentIndexRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const fadeDurationRef = useRef(fadeDuration);
  const segmentDelayRef = useRef(segmentDelay);
  const characterChunkSizeRef = useRef(characterChunkSize);
  const streamRef = useRef<AbortController | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    speedRef.current = speed;
    modeRef.current = mode;
    fadeDurationRef.current = fadeDuration;
    segmentDelayRef.current = segmentDelay;
    characterChunkSizeRef.current = characterChunkSize;
  }, [speed, mode, fadeDuration, segmentDelay, characterChunkSize]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const getChunkSize = useCallback(() => {
    if (typeof characterChunkSizeRef.current === "number") {
      return Math.max(1, characterChunkSizeRef.current);
    }

    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current));

    if (modeRef.current === "typewriter") {
      if (normalizedSpeed < 25) return 1;
      return Math.max(1, Math.round((normalizedSpeed - 25) / 10));
    } else if (modeRef.current === "fade") {
      return 1;
    }

    return 1;
  }, []);

  const getProcessingDelay = useCallback(() => {
    if (typeof segmentDelayRef.current === "number") {
      return Math.max(0, segmentDelayRef.current);
    }

    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current));
    return Math.max(1, Math.round(100 / Math.sqrt(normalizedSpeed)));
  }, []);

  const getFadeDuration = useCallback(() => {
    if (typeof fadeDurationRef.current === "number")
      return Math.max(10, fadeDurationRef.current);

    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current));
    return Math.round(1000 / Math.sqrt(normalizedSpeed));
  }, []);

  const getSegmentDelay = useCallback(() => {
    if (typeof segmentDelayRef.current === "number")
      return Math.max(0, segmentDelayRef.current);

    const normalizedSpeed = Math.min(100, Math.max(1, speedRef.current));
    return Math.max(1, Math.round(100 / Math.sqrt(normalizedSpeed)));
  }, []);

  const updateSegments = useCallback(
    (text: string) => {
      if (modeRef.current === "fade") {
        try {
          const segmenter = new Intl.Segmenter(navigator.language, {
            granularity: "word",
          });
          const segmentIterator = segmenter.segment(text);
          const newSegments = Array.from(segmentIterator).map(
            (segment, index) => ({
              text: segment.segment,
              index,
            })
          );
          setSegments(newSegments);
        } catch (error) {
          const newSegments = text
            .split(/(\s+)/)
            .filter(Boolean)
            .map((word, index) => ({
              text: word,
              index,
            }));
          setSegments(newSegments);
          onError?.(error);
        }
      }
    },
    [onError]
  ); // Added onError dependency

  const markComplete = useCallback(() => {
    if (!completedRef.current) {
      completedRef.current = true;
      setIsComplete(true);
      onCompleteRef.current?.();
    }
  }, []);

  const reset = useCallback(() => {
    currentIndexRef.current = 0;
    setDisplayedText("");
    setSegments([]);
    setIsComplete(false);
    completedRef.current = false;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const processStringTypewriter = useCallback(
    (text: string) => {
      let lastFrameTime = 0;

      const streamContent = (timestamp: number) => {
        const delay = getProcessingDelay();
        if (delay > 0 && timestamp - lastFrameTime < delay) {
          animationRef.current = requestAnimationFrame(streamContent);
          return;
        }
        lastFrameTime = timestamp;

        if (currentIndexRef.current >= text.length) {
          markComplete();
          return;
        }

        const chunkSize = getChunkSize();
        const endIndex = Math.min(
          currentIndexRef.current + chunkSize,
          text.length
        );
        const newDisplayedText = text.slice(0, endIndex);

        setDisplayedText(newDisplayedText);
        if (modeRef.current === "fade") {
          updateSegments(newDisplayedText);
        }

        currentIndexRef.current = endIndex;

        if (endIndex < text.length) {
          animationRef.current = requestAnimationFrame(streamContent);
        } else {
          markComplete();
        }
      };

      animationRef.current = requestAnimationFrame(streamContent);
    },
    [getProcessingDelay, getChunkSize, updateSegments, markComplete]
  );

  const processAsyncIterable = useCallback(
    async (stream: AsyncIterable<string>) => {
      const controller = new AbortController();
      streamRef.current = controller;

      let displayed = "";

      try {
        for await (const chunk of stream) {
          if (controller.signal.aborted) return;

          displayed += chunk;
          setDisplayedText(displayed);
          updateSegments(displayed);
        }

        markComplete();
      } catch (error) {
        console.error("Error processing text stream:", error);
        markComplete();
        onError?.(error);
      }
    },
    [updateSegments, markComplete, onError]
  );

  const startStreaming = useCallback(() => {
    reset();

    if (typeof textStream === "string") {
      processStringTypewriter(textStream);
    } else if (textStream) {
      processAsyncIterable(textStream);
    }
  }, [textStream, reset, processStringTypewriter, processAsyncIterable]);

  const pause = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    if (typeof textStream === "string" && !isComplete) {
      processStringTypewriter(textStream);
    }
  }, [textStream, isComplete, processStringTypewriter]);

  useEffect(() => {
    startStreaming();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.abort();
      }
    };
  }, [textStream, startStreaming]);

  return {
    displayedText,
    isComplete,
    segments,
    getFadeDuration,
    getSegmentDelay,
    reset,
    startStreaming,
    pause,
    resume,
  };
}

// Restore original props
export type ResponseStreamProps = {
  textStream: string | AsyncIterable<string>;
  mode?: Mode;
  speed?: number; // 1-100, where 1 is slowest and 100 is fastest
  className?: string;
  onComplete?: () => void;
  as?: keyof React.JSX.IntrinsicElements; // Element type to render
  fadeDuration?: number; // Custom fade duration in ms (overrides speed)
  segmentDelay?: number; // Custom delay between segments in ms (overrides speed)
  characterChunkSize?: number; // Custom characters per frame for typewriter mode (overrides speed)
};

// Restore original props in function signature
function ResponseStream({
  textStream,
  mode = "typewriter",
  speed = 20,
  className = "",
  onComplete,
  as = "div",
  fadeDuration,
  segmentDelay,
  characterChunkSize,
}: ResponseStreamProps) {
  // Removed unused animationEndRef
  // Removed unused 'isComplete', 'getFadeDuration' from destructuring
  const { displayedText } = useTextStream({
    textStream,
    speed,
    mode,
    onComplete,
    fadeDuration,
    segmentDelay,
    characterChunkSize,
  });

  // Removed unused useEffect for animationEndRef
  // Removed unused handleLastSegmentAnimationEnd callback
  // Removed unused fadeStyle definition

  const renderContent = () => {
    // Use MarkdownRenderer for both modes
    // The typewriter effect works as displayedText updates incrementally.
    // The fade effect's segment logic is replaced by rendering the full markdown.
    // If a distinct fade-in *per segment* is still desired with Markdown,
    // it would require a more complex integration, potentially passing segments
    // to MarkdownRenderer or handling fading outside.
    return <MarkdownRenderer content={displayedText} />;
  };

  const Container = as as keyof React.JSX.IntrinsicElements;

  return <Container className={className}>{renderContent()}</Container>;
}

export { useTextStream, ResponseStream };
