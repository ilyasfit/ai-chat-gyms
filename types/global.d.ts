// types/global.d.ts
import "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "agent-id": string;
        },
        HTMLElement
      >;
    }
  }
}

// Add type declaration for raw-loader
declare module "*.md" {
  const content: string;
  export = content; // Use export = syntax
}

// Export something to make it a module (even if empty)
export {};
