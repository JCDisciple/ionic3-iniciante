import { ErrorCode, Purchases, type Package } from '@revenuecat/purchases-js';

import { periodOf, PRO_ENTITLEMENT, sortOffers, type PlanOffer } from '@/lib/plans';

/**
 * Assinatura na web via RevenueCat Web Billing (cobrança pelo Stripe). Cai no
 * mesmo projeto do RevenueCat das lojas, então o webhook é um só.
 */
const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY;
const packages = new Map<string, Package>();

export const isBillingConfigured = () => !!apiKey;
export const billingChannel: 'store' | 'web' = 'web';

async function instance(userId: string): Promise<Purchases> {
  if (!apiKey) throw new Error('billing_not_configured');
  if (!Purchases.isConfigured()) return Purchases.configure({ apiKey, appUserId: userId });
  const purchases = Purchases.getSharedInstance();
  if (purchases.getAppUserId() !== userId) await purchases.changeUser(userId);
  return purchases;
}

export async function getOffers(userId: string): Promise<PlanOffer[]> {
  const purchases = await instance(userId);
  const offerings = await purchases.getOfferings();
  packages.clear();
  return sortOffers(
    (offerings.current?.availablePackages ?? []).map((pkg) => {
      packages.set(pkg.identifier, pkg);
      const product = pkg.webBillingProduct;
      return {
        id: pkg.identifier,
        title: product.title,
        price: product.currentPrice.formattedPrice,
        period: periodOf(pkg.packageType),
      };
    }),
  );
}

export async function purchase(userId: string, offer: PlanOffer): Promise<boolean> {
  const purchases = await instance(userId);
  const pkg = packages.get(offer.id);
  if (!pkg) throw new Error('offer_not_found');
  try {
    const { customerInfo } = await purchases.purchase({ rcPackage: pkg });
    return !!customerInfo.entitlements.active[PRO_ENTITLEMENT];
  } catch (error) {
    if ((error as { errorCode?: number }).errorCode === ErrorCode.UserCancelledError) return false;
    throw error;
  }
}

/** Na web a assinatura fica na conta: basta reler o estado. */
export async function restore(userId: string): Promise<boolean> {
  const info = await (await instance(userId)).getCustomerInfo();
  return !!info.entitlements.active[PRO_ENTITLEMENT];
}

export async function managementUrl(userId: string): Promise<string | null> {
  return (await (await instance(userId)).getCustomerInfo()).managementURL;
}
