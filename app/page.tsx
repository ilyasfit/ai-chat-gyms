"use client";

import { useState, useCallback } from "react"; // Added useCallback
// Import the main component and the type
import {
  V0AIChat,
  type Message as V0ChatMessage,
} from "@/components/ui/v0-ai-chat"; // Renamed import type
import { ThemeToggle } from "@/components/theme-toggle"; // Import ThemeToggle

// Define a new Message type that allows AsyncIterable
type Message = Omit<V0ChatMessage, "content"> & {
  content: string | AsyncIterable<string>;
};

// Define shimmer messages here as they are used for state in this component
const shimmerMessages = [
  "Safya is pondering your request...",
  "Processing with Safya's brilliance...",
  "Safya is crafting a response...",
  "Thinking deeply, Safya-style...",
  "Safya’s gears are turning...",
  "Hold on, Safya’s got this...",
  "Safya is working her magic...",
  "Analyzing with Safya’s wisdom...",
  "Safya’s thoughts are loading...",
  "Give Safya a moment to shine...",
];

export default function Home() {
  // Removed chatActive state as V0AIChat handles the layout now
  const [messages, setMessages] = useState<Message[]>([]); // Use the new Message type
  const [isLoading, setIsLoading] = useState(false);
  const [currentShimmerText, setCurrentShimmerText] = useState("");

  const handleSendMessage = async (userMessageContent: string) => {
    // Removed setting chatActive

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMessageContent,
    };

    // Removed: setMessages((prev) => [...prev, newUserMessage]); // This was causing duplication
    setIsLoading(true);

    // Add an empty assistant message placeholder
    const assistantMessageId = (Date.now() + 1).toString();
    const newAssistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "", // Start with empty content
    };

    // Capture the history *before* adding the new messages
    const historyForAPI = messages;

    // Update state first to add user message and placeholder
    setMessages((prevMessages) => [
      ...prevMessages,
      newUserMessage,
      newAssistantPlaceholder,
    ]);

    // Call the API *after* the state update, using the captured history
    fetchAndStreamResponse(
      userMessageContent,
      historyForAPI as V0ChatMessage[], // Use captured history (cast needed)
      assistantMessageId,
      setMessages // Pass setter to update the specific message
    );
  };

  // Function to create the async iterable for the stream
  const createStreamIterable = useCallback(
    async function* (
      stream: ReadableStream<Uint8Array>,
      assistantMessageId: string,
      setMessagesFn: React.Dispatch<React.SetStateAction<Message[]>>
    ): AsyncIterable<string> {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let firstChunkReceived = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          if (!firstChunkReceived) {
            // Stop shimmer on first chunk by setting isLoading false globally
            setIsLoading(false);
            firstChunkReceived = true;
          }

          const chunkText = decoder.decode(value, { stream: true });
          yield chunkText; // Yield the chunk for ResponseStream
        }
      } catch (error) {
        console.error("Error reading stream:", error);
        // Update the specific message with an error state
        setMessagesFn((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: "Sorry, something went wrong reading the stream.",
                }
              : msg
          )
        );
      } finally {
        // Ensure loading is false globally when stream ends
        setIsLoading(false);
      }
    },
    [] // No dependencies needed for useCallback as it uses passed args
  );

  // Separate function to handle fetching and setting up the stream iterable
  const fetchAndStreamResponse = async (
    userMessageContent: string,
    historyForAPI: V0ChatMessage[], // Use V0ChatMessage for API history
    assistantMessageId: string,
    setMessagesFn: React.Dispatch<React.SetStateAction<Message[]>> // Receive setter
  ) => {
    // Select random shimmer message while loading
    const randomShimmer =
      shimmerMessages[Math.floor(Math.random() * shimmerMessages.length)];
    setCurrentShimmerText(randomShimmer);
    setIsLoading(true); // Ensure loading is true before fetch
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessageContent,
          // Ensure history sent to API only contains strings
          history: historyForAPI.map((msg) => ({
            ...msg,
            content: typeof msg.content === "string" ? msg.content : "",
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      // Create the async iterable
      const streamIterable = createStreamIterable(
        response.body,
        assistantMessageId,
        setMessagesFn // Pass the setter down
      );

      // Update the specific assistant message content with the iterable
      setMessagesFn((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: streamIterable } // Assign the iterable here
            : msg
        )
      );

      // Note: isLoading is set to false inside createStreamIterable now
    } catch (error) {
      console.error("Error initiating stream:", error);
      // Update the specific message with an error state
      setMessagesFn((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: "Sorry, something went wrong initiating the stream.",
              }
            : msg
        )
      );
      setIsLoading(false); // Ensure loading is false on fetch error
    }
    // No finally block needed here for isLoading, handled in iterable or catch
  };
  // Render the main V0AIChat component, passing all necessary state and handlers
  // Cast messages back to V0ChatMessage[] for the prop type
  return (
    // Add relative positioning to the main container to position the toggle
    <main className="relative bg-neutral-950">
      {/* Add ThemeToggle button */}
      <div className="absolute top-4 right-4 z-10">
        {" "}
        {/* Position top-right */}
        <ThemeToggle />
      </div>
      <V0AIChat
        messages={messages as V0ChatMessage[]} // Cast messages for V0AIChat props
        isLoading={isLoading}
        currentShimmerText={currentShimmerText}
        onSendMessage={handleSendMessage}
      />
    </main>
  );
}
