import { marked } from 'marked';

marked.use({ gfm: true, breaks: false });

export function compileMarkdown(md: string): string {
  return marked.parse(md) as string;
}