import { strFromU8, unzipSync } from 'fflate';

/**
 * Leitor mínimo de XLSX: abre o zip, lê as strings compartilhadas e a
 * primeira planilha. Números saem como texto (datas do Excel ficam como
 * número de série; o mapeamento converte). Sem fórmulas nem formatação.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return String.fromCodePoint(n);
    }
    return ENTITIES[code] ?? m;
  });
}

function textOf(xml: string): string {
  // Junta todos os <t> (texto simples e trechos de "rich text")
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('');
}

export function columnIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function firstSheetPath(files: Record<string, Uint8Array>): string | null {
  const workbook = files['xl/workbook.xml'] && strFromU8(files['xl/workbook.xml']);
  const rels =
    files['xl/_rels/workbook.xml.rels'] && strFromU8(files['xl/_rels/workbook.xml.rels']);
  const rid = workbook?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (rid && rels) {
    const target =
      rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ??
      rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
    if (target) {
      const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
      if (files[path]) return path;
    }
  }
  return Object.keys(files).find((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)) ?? null;
}

export function readXlsx(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes);
  const sheetPath = firstSheetPath(files);
  if (!sheetPath) throw new Error('xlsx_without_sheet');

  const shared = files['xl/sharedStrings.xml']
    ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        textOf(m[1]),
      )
    : [];

  const sheet = strFromU8(files[sheetPath]);
  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    let next = 0;
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const inner = cell[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const index = ref ? columnIndex(ref) : next;
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      if (type === 's' && raw !== undefined) value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textOf(inner);
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
      else if (raw !== undefined) value = decodeXml(raw);
      while (row.length < index) row.push('');
      row[index] = value;
      next = index + 1;
    }
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}
