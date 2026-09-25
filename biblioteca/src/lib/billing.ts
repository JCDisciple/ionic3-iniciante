import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesPackage } from 'react-native-purchases';

import { periodOf, PRO_ENTITLEMENT, sortOffers, type PlanOffer } from '@/lib/plans';

/**
 * Assinatura nas lojas (App Store / Google Play) via RevenueCat. O app_user_id
 * é o id do usuário no Supabase: o webhook usa esse id para liberar o Pro.
 */
const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

let configuredFor: string | null = null;
const packages = new Map<string, PurchasesPackage>();

export const isBillingConfigured = () => !!apiKey;
export const billingChannel: 'store' | 'web' = 'store';

async function ensure(userId: string) {
  if (!apiKey) throw new Error('billing_not_configured');
  if (!configuredFor) {
    Purchases.configure({ apiKey, appUserID: userId });
    configuredFor = userId;
  } else if (configuredFor !== userId) {
    await Purchases.logIn(userId);
    configuredFor = userId;
  }
}

export async function getOffers(userId: string): Promise<PlanOffer[]> {
  await ensure(userId);
  const offerings = await Purchases.getOfferings();
  const available = offerings.current?.availablePackages ?? [];
  packages.clear();
  return sortOffers(
    available.map((pkg) => {
      packages.set(pkg.identifier, pkg);
      return {
        id: pkg.identifier,
        title: pkg.product.title,
        price: pkg.product.priceString,
        period: periodOf(pkg.packageType),
      };
    }),
  );
}

/** true = comprou; false = desistiu na tela da loja. */
export async function purchase(userId: string, offer: PlanOffer): Promise<boolean> {
  await ensure(userId);
  const pkg = packages.get(offer.id);
  if (!pkg) throw new Error('offer_not_found');
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return !!customerInfo.entitlements.active[PRO_ENTITLEMENT];
  } catch (error) {
    if ((error as { code?: string }).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR)
      return false;
    throw error;
  }
}

/** Restaurar compras (exigência da Apple para assinaturas). */
export async function restore(userId: string): Promise<boolean> {
  await ensure(userId);
  const info = await Purchases.restorePurchases();
  return !!info.entitlements.active[PRO_ENTITLEMENT];
}

/** Link para gerenciar/cancelar na loja. */
export async function managementUrl(userId: string): Promise<string | null> {
  await ensure(userId);
  return (await Purchases.getCustomerInfo()).managementURL;
}
