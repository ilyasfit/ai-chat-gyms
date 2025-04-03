// components/ui/markdown-renderer.tsx
import "highlight.js/styles/github-dark.css"; // Import a highlight.js theme

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return content;
  // <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
  //   {content}
  // </Markdown>
}
