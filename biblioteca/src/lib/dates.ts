/** Datas "de calendário" (AAAA-MM-DD) no fuso do aparelho, sem hora. */

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(now = new Date()): string {
  return toISODate(now);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

/** Dias entre duas datas (positivo se `to` for depois de `from`). */
export function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** 2026-09-25 → 25/09/2026 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** 25/09/2026 → 2026-09-25 (null se inválida). */
export function parseBRDate(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toISODate(date);
}

/** Texto curto para prazo de devolução: "vence hoje", "3 dias de atraso"… */
export function dueLabel(
  dueAt: string | null,
  today = todayISO(),
): { text: string; late: boolean } {
  if (!dueAt) return { text: 'sem data para voltar', late: false };
  const days = diffDays(today, dueAt);
  if (days < 0) {
    const late = -days;
    return { text: `${late} ${late === 1 ? 'dia' : 'dias'} de atraso`, late: true };
  }
  if (days === 0) return { text: 'vence hoje', late: false };
  if (days === 1) return { text: 'vence amanhã', late: false };
  return { text: `vence em ${formatDate(dueAt)}`, late: false };
}
