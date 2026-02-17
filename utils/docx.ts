import JSZip from 'jszip';

/**
 * Merge adjacent identical Markdown formatting markers.
 * When multiple consecutive runs share the same format, the naive
 * concatenation produces stuttered markers like "**Hello**** world**".
 * This cleans them into "**Hello world**".
 */
function mergeAdjacentFormatting(text: string): string {
  // Merge adjacent bold: **...**/**...**  →  **... ...**
  text = text.replace(/\*\*\*\*/g, '');
  // Merge adjacent italic: _...__..._  →  _... ..._
  text = text.replace(/__/g, '');
  // Merge adjacent bold-italic: **_..._****_..._**  →  **_... ..._**
  text = text.replace(/_\*\*\*\*_/g, '');
  return text;
}

/**
 * Extract text with formatting from a DOCX file in the browser.
 *
 * DOCX files are ZIP archives containing XML. The main body text
 * lives in `word/document.xml`. Each paragraph (`<w:p>`) contains
 * runs (`<w:r>`) with text (`<w:t>`) and optional run properties
 * (`<w:rPr>`) for bold (`<w:b>`), italic (`<w:i>`), etc.
 *
 * This function preserves bold/italic as Markdown syntax (**bold**,
 * _italic_, **_bold italic_**) so Claude gets better formatting
 * context when structuring the final Markdown.
 */
export async function extractDocxText(file: File): Promise<string> {
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (err) {
    throw new Error(`Failed to read file "${file.name}": ${err}`);
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch (err) {
    throw new Error(`Failed to decompress DOCX "${file.name}" — file may be corrupted: ${err}`);
  }

  const docXml = zip.file('word/document.xml');
  if (!docXml) throw new Error(`Invalid DOCX "${file.name}": missing word/document.xml`);

  const xmlText = await docXml.async('text');

  // Parse the XML using DOMParser (available in all modern browsers)
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  // Namespace-aware queries are cumbersome in the browser,
  // so use getElementsByTagName with the namespace prefix directly.
  const paragraphs: string[] = [];

  // Get all <w:p> (paragraph) elements
  const pElements = doc.getElementsByTagName('w:p');
  for (let i = 0; i < pElements.length; i++) {
    const p = pElements[i];

    // Extract runs with formatting from <w:r> elements
    const rElements = p.getElementsByTagName('w:r');
    const formattedParts: string[] = [];

    for (let j = 0; j < rElements.length; j++) {
      const run = rElements[j];

      // Get text content from <w:t> children of this run
      const tElements = run.getElementsByTagName('w:t');
      let runText = '';
      for (let k = 0; k < tElements.length; k++) {
        runText += tElements[k].textContent || '';
      }
      if (!runText) continue;

      // Check run properties for bold/italic
      const rPr = run.getElementsByTagName('w:rPr')[0];
      let isBold = false;
      let isItalic = false;

      if (rPr) {
        // <w:b/> or <w:b w:val="true"> means bold
        // <w:b w:val="false"> or <w:b w:val="0"> means NOT bold
        const bEl = rPr.getElementsByTagName('w:b')[0];
        if (bEl) {
          const val = bEl.getAttribute('w:val');
          isBold = val === null || (val !== 'false' && val !== '0');
        }
        // Same logic for italic
        const iEl = rPr.getElementsByTagName('w:i')[0];
        if (iEl) {
          const val = iEl.getAttribute('w:val');
          isItalic = val === null || (val !== 'false' && val !== '0');
        }
      }

      // Wrap with Markdown formatting
      if (isBold && isItalic) {
        formattedParts.push(`**_${runText}_**`);
      } else if (isBold) {
        formattedParts.push(`**${runText}**`);
      } else if (isItalic) {
        formattedParts.push(`_${runText}_`);
      } else {
        formattedParts.push(runText);
      }
    }

    // Check if this paragraph has a tab element (w:tab) — used for indentation
    const tabElements = p.getElementsByTagName('w:tab');

    // Check paragraph style for heading detection
    const pPr = p.getElementsByTagName('w:pPr')[0];
    let headingLevel = 0;
    let isList = false;

    if (pPr) {
      const pStyle = pPr.getElementsByTagName('w:pStyle')[0];
      if (pStyle) {
        const styleVal = pStyle.getAttribute('w:val') || '';
        // Detect headings: Heading1, Heading2, etc.
        const headingMatch = styleVal.match(/^Heading(\d)$/i);
        if (headingMatch) headingLevel = parseInt(headingMatch[1]);
        // Detect list items
        if (styleVal.match(/^List/i)) isList = true;
      }
      // Detect numbered/bullet lists via <w:numPr>
      const numPr = pPr.getElementsByTagName('w:numPr')[0];
      if (numPr) isList = true;
    }

    // Merge adjacent same-format markers to avoid stuttered output
    // e.g. "**Hello****, world**" → "**Hello, world**"
    const text = mergeAdjacentFormatting(formattedParts.join(''));
    if (!text.trim() && tabElements.length === 0) continue;

    if (headingLevel > 0) {
      paragraphs.push('#'.repeat(headingLevel) + ' ' + text.trim());
    } else if (isList) {
      paragraphs.push('- ' + text.trim());
    } else {
      paragraphs.push(text);
    }
  }

  return paragraphs.join('\n\n');
}
