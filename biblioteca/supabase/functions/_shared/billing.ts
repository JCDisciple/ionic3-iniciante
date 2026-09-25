/**
 * Tradução dos eventos de webhook do RevenueCat para o estado da assinatura.
 * Puro e testável. Referência dos campos: event.type, app_user_id, aliases,
 * product_id, store, environment, expiration_at_ms, transferred_from/to.
 */

export type RevenueCatEvent = {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  store?: string;
  environment?: string;
  expiration_at_ms?: number | null;
  transferred_from?: string[];
  transferred_to?: string[];
};

export type SubscriptionChange = {
  userId: string;
  provider: 'app_store' | 'play_store' | 'stripe' | 'promotional' | 'manual';
  productId: string;
  status: 'active' | 'cancelled' | 'billing_issue' | 'expired';
  expiresAt: string | null;
  environment: 'production' | 'sandbox';
  lastEvent: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O app faz Purchases.logIn(user.id): o id do Supabase vem em app_user_id ou nos aliases. */
export function supabaseUserId(event: RevenueCatEvent): string | null {
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  return candidates.find((id): id is string => !!id && UUID.test(id)) ?? null;
}

export function providerOf(store: string | undefined): SubscriptionChange['provider'] {
  switch (store) {
    case 'APP_STORE':
    case 'MAC_APP_STORE':
      return 'app_store';
    case 'PLAY_STORE':
      return 'play_store';
    case 'STRIPE':
    case 'RC_BILLING':
      return 'stripe';
    case 'PROMOTIONAL':
      return 'promotional';
    default:
      return 'manual';
  }
}

const STATUS_BY_TYPE: Record<string, SubscriptionChange['status']> = {
  INITIAL_PURCHASE: 'active',
  RENEWAL: 'active',
  PRODUCT_CHANGE: 'active',
  UNCANCELLATION: 'active',
  NON_RENEWING_PURCHASE: 'active',
  SUBSCRIPTION_EXTENDED: 'active',
  TEMPORARY_ENTITLEMENT_GRANT: 'active',
  CANCELLATION: 'cancelled', // vale até expirar
  BILLING_ISSUE: 'billing_issue', // período de carência
  SUBSCRIPTION_PAUSED: 'expired',
  EXPIRATION: 'expired',
};

/** null = evento que não muda assinatura (TEST, TRANSFER tratado à parte, etc.). */
export function subscriptionChange(event: RevenueCatEvent): SubscriptionChange | null {
  const status = STATUS_BY_TYPE[event.type];
  const userId = supabaseUserId(event);
  if (!status || !userId || !event.product_id) return null;
  return {
    userId,
    provider: providerOf(event.store),
    productId: event.product_id,
    status,
    expiresAt: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    environment: event.environment === 'SANDBOX' ? 'sandbox' : 'production',
    lastEvent: event.type,
  };
}

/** Pessoas cujo plano precisa ser recalculado depois do evento. */
export function affectedUsers(event: RevenueCatEvent): string[] {
  const ids =
    event.type === 'TRANSFER'
      ? [...(event.transferred_from ?? []), ...(event.transferred_to ?? [])]
      : [supabaseUserId(event)];
  return [...new Set(ids.filter((id): id is string => !!id && UUID.test(id)))];
}
