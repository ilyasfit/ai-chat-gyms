"use client";

import { useState, FormEvent } from "react";
import { Bot, Paperclip, Mic, CornerDownLeft } from "lucide-react"; // Removed Send
import { Button } from "@/components/ui/button";
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat-bubble";
import { ChatInput } from "@/components/ui/chat-input";
import {
  ExpandableChat,
  ExpandableChatHeader,
  ExpandableChatBody,
  ExpandableChatFooter,
} from "@/components/ui/expandable-chat";
import { ChatMessageList } from "@/components/ui/chat-message-list";

interface Message {
  id: number | string;
  content: string;
  sender: "user" | "ai";
}

export function ExpandableChatEmbed() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      content: "Olá! Sou a Mya, em que posso ajudar?", // Changed initial message
      sender: "ai",
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const currentInput = input.trim();
    if (!currentInput) return;

    const userMessage: Message = {
      id: Date.now(),
      content: currentInput,
      sender: "user",
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Prepare history for API: map sender "ai" to role "assistant"
    const apiHistory = messages.map((msg) => ({
      content: msg.content,
      role: msg.sender === "ai" ? "assistant" : "user",
    }));

    let aiResponseContent = "";
    const aiMessageId = Date.now() + "_ai";

    try {
      const response = await fetch("/api/chat/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: currentInput, history: apiHistory }),
      });

      if (!response.ok || !response.body) {
        throw new Error(
          `Network response was not ok. Status: ${response.status}`
        );
      }

      // Add an empty AI message placeholder to be updated by the stream
      setMessages((prev) => [
        ...prev,
        {
          id: aiMessageId,
          content: "", // Start with empty content
          sender: "ai",
        },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        aiResponseContent += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, content: aiResponseContent }
              : msg
          )
        );
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);
      // Update the placeholder or add a new message with the error
      setMessages(
        (prev) =>
          prev
            .map((msg) =>
              msg.id === aiMessageId
                ? { ...msg, content: "Error: Could not get AI response." }
                : msg.id === aiMessageId && msg.content === "" // If placeholder was added but stream failed before any content
                ? { ...msg, content: "Error: Could not get AI response." }
                : msg
            )
            .filter((msg) => !(msg.id === aiMessageId && msg.content === "")) // Clean up if placeholder is still empty and error occurred
      );
      // Add a new error message if the placeholder wasn't properly handled or to be more explicit
      if (
        !messages.find(
          (msg) => msg.id === aiMessageId && msg.content.startsWith("Error:")
        )
      ) {
        setMessages((prev) => [
          ...prev,
          {
            id: aiMessageId + "_error",
            content: "Error: Could not get AI response.",
            sender: "ai",
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttachFile = () => {
    // Placeholder for file attachment logic
    console.log("Attach file clicked");
  };

  const handleMicrophoneClick = () => {
    // Placeholder for microphone logic
    console.log("Microphone clicked");
  };

  return (
    // Removed sizing and positioning from this wrapper div.
    // The ExpandableChat component itself is position:fixed and handles its own layout.
    <div>
      <ExpandableChat
        size="lg" // size="md" might be more appropriate for a 400px wide iframe. lg is max-w-lg (32rem = 512px)
        position="bottom-right"
        icon={<Bot className="h-6 w-6" />}
        initialOpen={false} // Chat should start closed (bubble only)
        // isEmbed={true} // Removed, not a valid prop
      >
        <ExpandableChatHeader className="flex-col text-center justify-center">
          <h1 className="text-xl font-semibold">Chat with AI ✨</h1>
          <p className="text-sm text-muted-foreground">Ask me anything!</p>
        </ExpandableChatHeader>

        <ExpandableChatBody>
          <ChatMessageList>
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                variant={message.sender === "user" ? "sent" : "received"}
              >
                <ChatBubbleAvatar
                  className="h-8 w-8 shrink-0"
                  src={
                    message.sender === "user"
                      ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&q=80&crop=faces&fit=crop"
                      : "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&q=80&crop=faces&fit=crop"
                  }
                  fallback={message.sender === "user" ? "US" : "AI"}
                />
                <ChatBubbleMessage
                  variant={message.sender === "user" ? "sent" : "received"}
                >
                  {message.content}
                </ChatBubbleMessage>
              </ChatBubble>
            ))}

            {isLoading &&
              messages[messages.length - 1]?.sender === "user" && ( // Show loading only if last message was user and expecting AI
                <ChatBubble variant="received">
                  <ChatBubbleAvatar
                    className="h-8 w-8 shrink-0"
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&q=80&crop=faces&fit=crop"
                    fallback="AI"
                  />
                  <ChatBubbleMessage isLoading />
                </ChatBubble>
              )}
          </ChatMessageList>
        </ExpandableChatBody>

        <ExpandableChatFooter>
          <form
            onSubmit={handleSubmit}
            className="relative rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring p-1"
          >
            <ChatInput
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setInput(e.target.value)
              }
              placeholder="Type your message..."
              className="min-h-12 resize-none rounded-lg bg-background border-0 p-3 shadow-none focus-visible:ring-0"
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  // Create a synthetic form event or call a modified handleSubmit
                  // For now, we'll keep the cast, assuming ChatInput is within the form
                  const form = e.currentTarget.closest("form");
                  if (form) {
                    // Simulate a submit event on the form
                    // This is a bit of a workaround. Ideally, the Button type="submit" handles this.
                    // Or, refactor handleSubmit to not strictly require a FormEvent if called programmatically.
                    // For now, let's try to trigger the form's submit.
                    // handleSubmit(new Event('submit', { cancelable: true }) as unknown as FormEvent);
                    // The above doesn't work directly.
                    // A simpler way is to get the submit button and click it, or call form.requestSubmit()
                    if (form.requestSubmit) {
                      form.requestSubmit();
                    } else {
                      // Fallback for older browsers or if no submit button is explicitly found by this logic
                      handleSubmit(e as unknown as FormEvent);
                    }
                  } else {
                    handleSubmit(e as unknown as FormEvent); // Fallback if form is not found
                  }
                }
              }}
            />
            <div className="flex items-center p-3 pt-0 justify-between">
              <div className="flex">
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={handleAttachFile}
                  aria-label="Attach file"
                >
                  <Paperclip className="size-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={handleMicrophoneClick}
                  aria-label="Use microphone"
                >
                  <Mic className="size-4" />
                </Button>
              </div>
              <Button
                type="submit"
                size="sm"
                className="ml-auto gap-1.5"
                disabled={isLoading || !input.trim()}
              >
                Send Message
                <CornerDownLeft className="size-3.5" />
              </Button>
            </div>
          </form>
        </ExpandableChatFooter>
      </ExpandableChat>
    </div>
  );
}
