import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn(
      "text-sm leading-relaxed prose prose-invert max-w-none",
      "[&_p]:my-0 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
      "[&_ul]:my-1 [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:pl-4",
      "[&_li]:my-0.5",
      "[&_code]:bg-muted/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px]",
      "[&_pre]:bg-muted/50 [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-1.5",
      "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
      "[&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80",
      "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:my-1.5 [&_blockquote]:italic",
      "[&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-medium",
      "[&_hr]:my-2 [&_hr]:border-border",
      "[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-1.5",
      className
    )}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
