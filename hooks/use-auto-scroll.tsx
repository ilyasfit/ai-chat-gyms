import { useCallback, useEffect, useRef, useState } from "react";

interface ScrollState {
  isAtBottom: boolean;
  autoScrollEnabled: boolean;
}

interface UseAutoScrollOptions {
  offset?: number;
  smooth?: boolean;
  content?: React.ReactNode;
}

export function useAutoScroll(options: UseAutoScrollOptions = {}) {
  // Reduce the offset for a stricter "at bottom" check
  const { offset = 10, smooth = false, content } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastContentHeight = useRef(0);
  const userHasScrolled = useRef(false);
  const lastScrollTop = useRef(0); // Add ref to track last scroll position

  const [scrollState, setScrollState] = useState<ScrollState>({
    isAtBottom: true,
    autoScrollEnabled: true,
  });

  const checkIsAtBottom = useCallback(
    (element: HTMLElement) => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const distanceToBottom = Math.abs(
        scrollHeight - scrollTop - clientHeight
      );
      return distanceToBottom <= offset;
    },
    [offset]
  );

  const scrollToBottom = useCallback(
    (instant?: boolean) => {
      if (!scrollRef.current) return;

      const targetScrollTop =
        scrollRef.current.scrollHeight - scrollRef.current.clientHeight;

      if (instant) {
        scrollRef.current.scrollTop = targetScrollTop;
      } else {
        scrollRef.current.scrollTo({
          top: targetScrollTop,
          behavior: smooth ? "smooth" : "auto",
        });
      }

      setScrollState({
        isAtBottom: true,
        autoScrollEnabled: true,
      });
      userHasScrolled.current = false;
    },
    [smooth]
  );

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const { scrollTop } = element;
    const isScrollingUp = scrollTop < lastScrollTop.current;
    const atBottom = checkIsAtBottom(element);

    if (isScrollingUp && !atBottom) {
      // User scrolled up and is not in the bottom zone
      userHasScrolled.current = true;
    } else if (!isScrollingUp && atBottom) {
      // User scrolled down into the bottom zone
      userHasScrolled.current = false;
    }

    setScrollState({
      // Update state directly based on current check
      isAtBottom: atBottom,
      autoScrollEnabled: !userHasScrolled.current, // Enable only if user hasn't scrolled up
    });

    lastScrollTop.current = scrollTop <= 0 ? 0 : scrollTop; // Update last scroll position
  }, [checkIsAtBottom]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const currentHeight = scrollElement.scrollHeight;
    const hasNewContent = currentHeight !== lastContentHeight.current;

    if (hasNewContent) {
      // Scroll down if new content arrives UNLESS the user has manually scrolled up
      if (!userHasScrolled.current) {
        // Use setTimeout to ensure scroll happens after potential rendering updates
        setTimeout(() => {
          // Scroll instantly on initial load, smoothly otherwise
          scrollToBottom(lastContentHeight.current === 0 || !smooth);
        }, 0);
      }
      lastContentHeight.current = currentHeight;
    }
    // Dependency array updated: check userHasScrolled instead of scrollState.autoScrollEnabled
  }, [content, userHasScrolled, scrollToBottom, smooth]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    // Also adjust resize observer to respect user scroll state
    const resizeObserver = new ResizeObserver(() => {
      if (!userHasScrolled.current) {
        scrollToBottom(true); // Scroll instantly on resize if auto-scroll is effectively enabled
      }
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [scrollState.autoScrollEnabled, scrollToBottom]);

  const disableAutoScroll = useCallback(() => {
    const atBottom = scrollRef.current
      ? checkIsAtBottom(scrollRef.current)
      : false;

    // Only disable if not at bottom
    if (!atBottom) {
      userHasScrolled.current = true;
      setScrollState((prev) => ({
        ...prev,
        autoScrollEnabled: false,
      }));
    }
  }, [checkIsAtBottom]);

  return {
    scrollRef,
    isAtBottom: scrollState.isAtBottom,
    autoScrollEnabled: scrollState.autoScrollEnabled,
    scrollToBottom: () => scrollToBottom(false),
    disableAutoScroll,
  };
}
