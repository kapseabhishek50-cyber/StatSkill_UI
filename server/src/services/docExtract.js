import mammoth from 'mammoth';
import JSZip from 'jszip';

/**
 * Document text extraction.
 *
 * Runs once, at upload, and the text is stored on the profile. Nothing downstream
 * re-parses a file: a read path that re-runs extraction is a read path that can
 * fail on a corrupt PDF long after the officer who uploaded it has gone.
 *
 * pdf-parse is loaded lazily because its package entry point reads a bundled test
 * file when imported at module scope in some versions - a cost, and a failure
 * mode, that a server which may never see a PDF should not pay at boot.
 */

const MAX_CHARS = 40000;

export class UnsupportedDocument extends Error {
  constructor(mimetype) {
    super(`Unsupported document type: ${mimetype || 'unknown'}. Upload a PDF or DOCX.`);
    this.name = 'UnsupportedDocument';
  }
}

/** Collapses the whitespace soup that PDF extraction usually produces. */
function tidy(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CHARS);
}

async function fromPdf(buffer) {
  // Import the parser implementation directly. The package entry point runs
  // its test fixture when loaded through Node's ESM interop, which makes every
  // real upload fail with ENOENT before the uploaded buffer is examined.
  try {
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
    const parsed = await pdfParse(buffer);
    return parsed?.text ?? '';
  } catch (error) {
    throw new Error(`PDF parsing failed: ${error.message || 'Invalid or encrypted PDF structure'}. Please ensure the PDF has text content.`);
  }
}

async function fromDocx(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

async function fromPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)[1]) - Number(b.match(/slide(\d+)/i)[1]));
  const slides = await Promise.all(
    slideNames.map(async (name) => {
      const xml = await zip.files[name].async('text');
      return xml
        .replace(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi, '$1 ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    }),
  );
  return slides.join('\n\n');
}

/**
 * @param {{ buffer: Buffer, mimetype: string, originalname: string }} file
 * @returns {Promise<{ text: string, chars: number, truncated: boolean }>}
 */
export async function extractText(file) {
  const name = String(file?.originalname ?? '').toLowerCase();
  const mimetype = String(file?.mimetype ?? '');

  let raw;
  if (mimetype === 'application/pdf' || name.endsWith('.pdf')) {
    raw = await fromPdf(file.buffer);
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    raw = await fromDocx(file.buffer);
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    name.endsWith('.pptx')
  ) {
    raw = await fromPptx(file.buffer);
  } else if (mimetype === 'text/plain' || name.endsWith('.txt')) {
    raw = file.buffer ? file.buffer.toString('utf8') : '';
  } else {
    throw new UnsupportedDocument(mimetype);
  }

  const text = tidy(raw);
  return { text, chars: text.length, truncated: String(raw ?? '').length > MAX_CHARS };
}

/**
 * Splits text into overlapping chunks. Not needed for a two-page CV, which fits
 * in one prompt - this is here for the longer service records, and the overlap
 * keeps a qualification that straddles a boundary from being lost.
 */
export function chunk(text, { size = 6000, overlap = 400 } = {}) {
  const chunks = [];
  for (let start = 0; start < text.length; start += size - overlap) {
    chunks.push(text.slice(start, start + size));
    if (start + size >= text.length) break;
  }
  return chunks;
}
