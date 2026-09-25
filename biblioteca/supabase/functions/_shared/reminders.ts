/** Regras dos lembretes de devolução (puras, testáveis). */

export const REMIND_EVERY_DAYS = 7;

/** Data de hoje (AAAA-MM-DD) no fuso informado. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Lembra no dia da devolução e depois a cada 7 dias enquanto estiver atrasado. */
export function shouldRemind(
  loan: { due_at: string | null; returned_at: string | null; last_reminded_on: string | null },
  today: string,
): boolean {
  if (loan.returned_at || !loan.due_at || loan.due_at > today) return false;
  if (!loan.last_reminded_on) return true;
  return daysBetween(loan.last_reminded_on, today) >= REMIND_EVERY_DAYS;
}

export function reminderMessage(bookTitle: string, borrower: string, dueAt: string, today: string) {
  const late = daysBetween(dueAt, today);
  return {
    title: late > 0 ? `${bookTitle} está atrasado` : `Hoje é dia de ${borrower} devolver`,
    body:
      late > 0
        ? `${borrower} está com o livro há ${late} ${late === 1 ? 'dia' : 'dias'} além do combinado.`
        : `${bookTitle} deveria voltar hoje para a estante.`,
    url: '/emprestados',
  };
}
