export function compileMarkdown(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let inParagraph = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed === '') {
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      const level = headingMatch[1]!.length;
      result.push(`<h${level}>${headingMatch[2]}</h${level}>`);
      continue;
    }

    const hrMatch = trimmed.match(/^[-*_]{3,}$/);
    if (hrMatch) {
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      result.push('<hr>');
      continue;
    }

    let processed = trimmed
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    if (!inParagraph) {
      result.push('<p>');
      inParagraph = true;
    } else {
      result.push(' ');
    }
    result.push(processed);
  }

  if (inParagraph) {
    result.push('</p>');
  }

  return result.join('');
}