/** Regras de planos no app (puras). Os limites em si vêm da tabela public.plans. */

export const PRO_ENTITLEMENT = 'pro';

export type PlanLimitKind = 'books' | 'members';

/** Reconhece os erros dos gatilhos de limite (plan_limit_books / plan_limit_members). */
export function planLimitError(error: unknown): PlanLimitKind | null {
  const message = String((error as { message?: string } | null)?.message ?? error ?? '');
  if (message.includes('plan_limit_books')) return 'books';
  if (message.includes('plan_limit_members')) return 'members';
  return null;
}

export const PLAN_LIMIT_MESSAGES: Record<PlanLimitKind, string> = {
  books:
    'A biblioteca chegou ao limite de livros do plano gratuito. Assine o Pro para continuar catalogando.',
  members: 'A biblioteca chegou ao limite de pessoas do plano. Com o Pro, cabe a família toda.',
};

export type Period = 'annual' | 'monthly' | 'other';

export type PlanOffer = {
  id: string;
  title: string;
  price: string;
  period: Period;
};

/** Anual primeiro (melhor preço), depois mensal, depois o resto. */
export function sortOffers<T extends { period: Period }>(offers: T[]): T[] {
  const order: Record<Period, number> = { annual: 0, monthly: 1, other: 2 };
  return [...offers].sort((a, b) => order[a.period] - order[b.period]);
}

export function periodOf(packageType: string): Period {
  const key = packageType.toLowerCase();
  if (key.includes('annual')) return 'annual';
  if (key.includes('monthly')) return 'monthly';
  return 'other';
}

export const PERIOD_LABELS: Record<Period, string> = {
  annual: 'por ano',
  monthly: 'por mês',
  other: '',
};

export type Usage = {
  plan: 'free' | 'pro';
  plan_name: string;
  books: number;
  max_books: number | null;
  members: number;
  max_members: number | null;
};

/** Fração usada do limite (null = ilimitado) e se está perto do fim (≥ 90%). */
export function usageLevel(
  used: number,
  max: number | null,
): { fraction: number | null; nearLimit: boolean } {
  if (max === null) return { fraction: null, nearLimit: false };
  const fraction = Math.min(1, used / max);
  return { fraction, nearLimit: fraction >= 0.9 };
}
