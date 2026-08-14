import { describe, it, expect } from 'vitest';
import { compileMarkdown } from '$lib/server/markdown';

describe('compileMarkdown', () => {
  it('compiles headings', () => {
    const h = compileMarkdown('# H1');
    expect(h).toContain('<h1>H1</h1>');
  });

  it('compiles headings with inline formatting', () => {
    const h = compileMarkdown('## **Bold** heading');
    expect(h).toContain('<h2><strong>Bold</strong> heading</h2>');
  });

  it('compiles unordered lists', () => {
    const h = compileMarkdown('- one\n- two\n- three');
    expect(h).toContain('<li>one</li>');
    expect(h).toContain('<li>two</li>');
    expect(h).toContain('<li>three</li>');
  });

  it('compiles ordered lists', () => {
    const h = compileMarkdown('1. one\n2. two\n3. three');
    expect(h).toContain('<li>one</li>');
    expect(h).toContain('<li>two</li>');
    expect(h).toContain('<li>three</li>');
  });

  it('applies inline formatting inside list items', () => {
    const h = compileMarkdown('- **bold** item\n- [link](https://x.com)');
    expect(h).toContain('<strong>bold</strong>');
    expect(h).toContain('<a href="https://x.com">link</a>');
  });

  it('compiles a list followed by a paragraph', () => {
    const h = compileMarkdown('- one\n- two\n\nAfter the list.');
    expect(h).toContain('<li>one</li>');
    expect(h).toContain('<p>After the list.</p>');
  });

  it('compiles horizontal rules', () => {
    expect(compileMarkdown('---')).toContain('<hr');
  });

  it('compiles paragraphs and inline formatting', () => {
    const h = compileMarkdown('**bold** and *em*');
    expect(h).toContain('<strong>bold</strong>');
    expect(h).toContain('<em>em</em>');
  });

  it('compiles the Al-Noor about markdown', () => {
    const md =
      '## Our Story\n\nServing the community since 1995.\n\n### Services\n\n- Five daily prayers\n- Jumu\'ah khutbah\n- Quran classes';
    const html = compileMarkdown(md);
    expect(html).toContain('<h2>Our Story</h2>');
    expect(html).toContain('<h3>Services</h3>');
    expect(html).toContain('<li>Five daily prayers</li>');
    expect(html).toContain('Jumu'); // marked escapes the apostrophe to &#39;
    expect(html).toContain('<li>Quran classes</li>');
  });

  // ── GFM features provided by marked ──────────────────────────────────────

  it('compiles blockquotes', () => {
    const h = compileMarkdown('> quoted text');
    expect(h).toContain('<blockquote');
    expect(h).toContain('<p>quoted text</p>');
  });

  it('compiles fenced code blocks', () => {
    const h = compileMarkdown('```js\nconsole.log("hi");\n```');
    expect(h).toContain('<pre><code class="language-js">');
    expect(h).toContain('console.log(&quot;hi&quot;)');
  });

  it('compiles inline code', () => {
    const h = compileMarkdown('Use `npm install` to install');
    expect(h).toContain('<code>npm install</code>');
  });

  it('compiles GFM tables', () => {
    const h = compileMarkdown('| A | B |\n| - | - |\n| 1 | 2 |');
    expect(h).toContain('<table>');
    expect(h).toContain('<th>A</th>');
    expect(h).toContain('<td>1</td>');
  });

  it('compiles task lists', () => {
    const h = compileMarkdown('- [x] done\n- [ ] pending');
    expect(h).toContain('checked');
  });

  it('compiles strikethrough', () => {
    const h = compileMarkdown('~~struck~~');
    expect(h).toContain('<del>struck</del>');
  });

  it('compiles nested lists', () => {
    const h = compileMarkdown('- parent\n  - child\n  - child2');
    expect(h).toContain('<li>child</li>');
    expect(h).toContain('<li>child2</li>');
  });

  it('compiles images', () => {
    const h = compileMarkdown('![alt](https://example.com/img.png)');
    expect(h).toContain('<img');
    expect(h).toContain('alt="alt"');
    expect(h).toContain('src="https://example.com/img.png"');
  });
});