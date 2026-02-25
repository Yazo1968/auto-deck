import { Heading } from '../types';

export const parseMarkdownStructure = (text: string): Heading[] => {
  const lines = text.split('\n');
  const headings: Heading[] = [];
  const headingRegex = /^(#{1,6})\s+(.*)$/;
  let currentOffset = 0;
  lines.forEach((line, index) => {
    const match = line.match(headingRegex);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        id: `h-${index}-${Math.random().toString(36).substr(2, 4)}`,
        selected: false,
        startIndex: currentOffset,
      });
    }
    currentOffset += line.length + 1;
  });
  return headings;
};

export const htmlToMarkdown = (html: string): string => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  let md = '';

  const walk = (node: Node, listDepth = 0) => {
    if (node.nodeType === Node.TEXT_NODE) {
      md += node.textContent;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = () => Array.from(node.childNodes).forEach((c) => walk(c, listDepth));

    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        if (md && !md.endsWith('\n')) md += '\n';
        md += '#'.repeat(parseInt(tag[1])) + ' ';
        children();
        md += '\n\n';
        break;
      case 'p':
        if (md && !md.endsWith('\n\n')) md += '\n\n';
        children();
        md += '\n\n';
        break;
      case 'br':
        md += '\n';
        break;
      case 'strong':
      case 'b':
        md += '**';
        children();
        md += '**';
        break;
      case 'em':
      case 'i':
        md += '_';
        children();
        md += '_';
        break;
      case 'a': {
        const href = el.getAttribute('href') || '';
        md += '[';
        children();
        md += `](${href})`;
        break;
      }
      case 'ul':
      case 'ol':
        if (md && !md.endsWith('\n')) md += '\n';
        Array.from(node.childNodes).forEach((c) => walk(c, listDepth + 1));
        if (!md.endsWith('\n')) md += '\n';
        break;
      case 'li': {
        const indent = '  '.repeat(Math.max(0, listDepth - 1));
        const parent = el.parentElement?.tagName.toLowerCase();
        const bullet = parent === 'ol' ? `${Array.from(el.parentElement!.children).indexOf(el) + 1}. ` : '- ';
        md += indent + bullet;
        children();
        if (!md.endsWith('\n')) md += '\n';
        break;
      }
      case 'blockquote':
        if (md && !md.endsWith('\n')) md += '\n';
        md += '> ';
        children();
        if (!md.endsWith('\n')) md += '\n';
        break;
      case 'pre': {
        if (md && !md.endsWith('\n')) md += '\n';
        const code = el.querySelector('code');
        md += '```\n' + (code?.textContent || el.textContent || '') + '\n```\n\n';
        break;
      }
      case 'code':
        if (el.parentElement?.tagName.toLowerCase() !== 'pre') {
          md += '`';
          children();
          md += '`';
        }
        break;
      case 'hr':
        md += '\n---\n\n';
        break;
      case 'table': {
        if (md && !md.endsWith('\n')) md += '\n';
        const rows = el.querySelectorAll('tr');
        rows.forEach((tr, ri) => {
          const cells = tr.querySelectorAll('td, th');
          md +=
            '| ' +
            Array.from(cells)
              .map((c) => c.textContent?.trim() || '')
              .join(' | ') +
            ' |\n';
          if (ri === 0) {
            md +=
              '| ' +
              Array.from(cells)
                .map(() => '---')
                .join(' | ') +
              ' |\n';
          }
        });
        md += '\n';
        break;
      }
      case 'div':
        // Skip root title div — not part of markdown content
        if (el.hasAttribute('data-root-title')) break;
        if (md && !md.endsWith('\n')) md += '\n';
        children();
        if (!md.endsWith('\n')) md += '\n';
        break;
      default:
        children();
        break;
    }
  };

  Array.from(tempDiv.childNodes).forEach((c) => walk(c, 0));
  return md.trim().replace(/\n{3,}/g, '\n\n');
};
