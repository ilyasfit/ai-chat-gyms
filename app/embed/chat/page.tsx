import { ExpandableChatEmbed } from "@/components/expandable-chat-embed";

export default function ChatEmbedPage() {
  return (
    // Changed background to transparent. The w-full and h-screen might not be strictly necessary
    // if the ExpandableChat component correctly positions itself fixed within the viewport.
    // However, ensuring the body/html of this page has no background and this div is transparent is key.
    <div className="w-full h-screen bg-transparent">
      {/* 
        The ExpandableChatEmbed component itself is designed to be a full-height chat interface (h-[600px] currently).
        For an iframe embed, often you want the embedded content to fill the iframe.
        The h-[600px] and max-w-md are inside ExpandableChatEmbed.
        This page provides a basic container.
      */}
      <div className="h-screen">Test</div>
      Hello there!
      <div className="h-screen">Test</div>
      <ExpandableChatEmbed />
    </div>
  );
}
