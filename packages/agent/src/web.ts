const MAX_CONTENT_LENGTH = 8000;
const SEARCH_TIMEOUT_MS = 8000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_SEARCH_RESULTS = 8;
const MAX_FETCH_SIZE = 500_000;

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const KNOWN_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&#x27;': "'",
};

function decodeEntities(html: string): string {
  return html.replace(/&[#\w]+;/g, (m) => KNOWN_ENTITIES[m] || m);
}

function stripHtml(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  text = decodeEntities(text);
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/^[ \t]+/gm, '');

  return text.trim();
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export async function searchWeb(query: string): Promise<{ results: SearchResult[]; error?: string }> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MasjidBot/1.0)',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return { results: [], error: `Search returned HTTP ${response.status}` };
    }

    const html = await response.text();
    const results = parseDuckDuckGoLite(html);
    return { results };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { results: [], error: 'Search timed out' };
    }
    return { results: [], error: err instanceof Error ? err.message : String(err) };
  }
}

function parseDuckDuckGoLite(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  const linkRegex = /<a[^>]*rel="nofollow"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  const links: Array<{ title: string; url: string }> = [];
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const rawUrl = linkMatch[1] ?? '';
    const title = collapseWhitespace(stripHtml(linkMatch[2] ?? ''));
    if (title && rawUrl && !rawUrl.startsWith('//duckduckgo.com')) {
      links.push({ title, url: rawUrl });
    }
  }

  const snippets: string[] = [];
  let snippetMatch: RegExpExecArray | null;
  while ((snippetMatch = snippetRegex.exec(html)) !== null) {
    const snippet = collapseWhitespace(stripHtml(snippetMatch[1] ?? ''));
    if (snippet) snippets.push(snippet);
  }

  const count = Math.min(links.length, snippets.length, MAX_SEARCH_RESULTS);
  for (let i = 0; i < count; i++) {
    const link = links[i];
    const snippet = snippets[i];
    if (link && snippet !== undefined) {
      results.push({ title: link.title, url: link.url, snippet });
    }
  }

  if (results.length === 0 && links.length > 0) {
    for (let i = 0; i < Math.min(links.length, MAX_SEARCH_RESULTS); i++) {
      const link = links[i];
      if (link) {
        results.push({ title: link.title, url: link.url, snippet: '' });
      }
    }
  }

  return results;
}

export async function fetchUrl(targetUrl: string): Promise<{ content: string; contentType: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MasjidBot/1.0)',
        'Accept': 'text/html,text/plain,*/*',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return { content: '', contentType: '', error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const contentType = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FETCH_SIZE) {
      return { content: '', contentType, error: `Content too large (${contentLength} bytes, max ${MAX_FETCH_SIZE})` };
    }

    if (contentType.includes('text/html')) {
      const html = await response.text();
      if (html.length > MAX_FETCH_SIZE) {
        return { content: '', contentType, error: `HTML too large (${html.length} bytes)` };
      }
      const text = stripHtml(html);
      const truncated = text.length > MAX_CONTENT_LENGTH
        ? text.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... content truncated ...]'
        : text;
      return { content: truncated, contentType };
    }

    if (contentType.includes('text/plain') || contentType.includes('application/json')) {
      const raw = await response.text();
      const truncated = raw.length > MAX_CONTENT_LENGTH
        ? raw.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... content truncated ...]'
        : raw;
      return { content: truncated, contentType };
    }

    return { content: '', contentType, error: `Unsupported content type: ${contentType}. Only HTML, plain text, and JSON are supported.` };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { content: '', contentType: '', error: 'Request timed out' };
    }
    return { content: '', contentType: '', error: err instanceof Error ? err.message : String(err) };
  }
}