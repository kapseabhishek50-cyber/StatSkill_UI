import fs from 'fs';

export type FileType = 'PDF' | 'DOCX' | 'PPTX' | 'TXT';

/**
 * Text extraction for learning materials (prompt §23).
 * PDF → pdf-parse, DOCX → mammoth, PPTX → jszip (slide XML), TXT → direct.
 */
export const extractText = async (filePath: string, fileType: FileType): Promise<string> => {
  switch (fileType) {
    case 'TXT':
      return fs.promises.readFile(filePath, 'utf-8');

    case 'PDF': {
      const pdfParse = (await import('pdf-parse')).default;
      const buffer = await fs.promises.readFile(filePath);
      const result = await pdfParse(buffer);
      return result.text;
    }

    case 'DOCX': {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    case 'PPTX': {
      const JSZip = (await import('jszip')).default;
      const data = await fs.promises.readFile(filePath);
      const zip = await JSZip.loadAsync(data);
      const slideFiles = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
          const na = Number(a.match(/slide(\d+)/)?.[1] ?? 0);
          const nb = Number(b.match(/slide(\d+)/)?.[1] ?? 0);
          return na - nb;
        });
      const texts: string[] = [];
      for (const name of slideFiles) {
        const xml = await zip.files[name].async('string');
        // Pull text runs out of the DrawingML XML.
        const runs = xml.match(/<a:t>([^<]*)<\/a:t>/g) ?? [];
        const line = runs
          .map((r) => r.replace(/<\/?a:t>/g, '').trim())
          .filter(Boolean)
          .join(' ');
        if (line) texts.push(line);
      }
      return texts.join('\n\n');
    }

    default:
      throw new Error(`Unsupported file type: ${fileType as string}`);
  }
};

/** Cleans extracted text: collapses whitespace, strips control chars. */
export const cleanText = (raw: string): string =>
  raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
