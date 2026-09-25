import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { Body, Label, Muted, Subheading } from '@/components/ui/typography';
import { usePalette } from '@/hooks/use-palette';
import {
  billingChannel,
  getOffers,
  isBillingConfigured,
  managementUrl,
  purchase,
  restore,
} from '@/lib/billing';
import { PERIOD_LABELS, usageLevel, type PlanOffer } from '@/lib/plans';
import { useLibraryUsage } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useCurrentLibrary, useLibrary } from '@/providers/library-provider';

type PlanRow = {
  id: 'free' | 'pro';
  name: string;
  max_books: number | null;
  max_members: number | null;
};

const limitText = (max: number | null | undefined, unit: string) =>
  max === undefined ? '—' : max === null ? 'ilimitado' : `até ${max}${unit}`;

/** Planos pagos: uso atual, comparação e compra (só o dono da biblioteca). */
export default function PlansScreen() {
  const current = useCurrentLibrary();
  const { isOwner, refresh } = useLibrary();
  const { user } = useAuth();
  const palette = usePalette();
  const usage = useLibraryUsage();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const offers = useQuery({
    queryKey: ['billing-offers', user?.id],
    enabled: isOwner && isBillingConfigured() && !!user,
    retry: false,
    queryFn: () => getOffers(user!.id),
  });

  const isPro = usage.data?.plan === 'pro';
  const plans = useQuery({
    queryKey: ['plans'],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error: plansError } = await supabase
        .from('plans')
        .select('id, name, max_books, max_members');
      if (plansError) throw new Error(plansError.message);
      return data as PlanRow[];
    },
  });
  const free = plans.data?.find((p) => p.id === 'free');
  const pro = plans.data?.find((p) => p.id === 'pro');
  const features = [
    {
      label: 'Livros no acervo',
      free: limitText(free?.max_books, ''),
      pro: limitText(pro?.max_books, ''),
    },
    {
      label: 'Pessoas na família',
      free: limitText(free?.max_members, ''),
      pro: limitText(pro?.max_members, ''),
    },
    { label: 'Leituras, metas e relatórios', free: 'sim', pro: 'sim' },
    { label: 'Importar, exportar, Instagram', free: 'sim', pro: 'sim' },
  ];

  /** O webhook do RevenueCat atualiza o plano em segundos; espera até ~30 s. */
  async function waitForPro() {
    for (let i = 0; i < 15; i++) {
      const { data } = await supabase.rpc('library_usage', { p_library_id: current.library_id });
      if ((data as { plan: string }[] | null)?.[0]?.plan === 'pro') break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    await refresh();
    queryClient.invalidateQueries({ queryKey: ['library', current.library_id] });
  }

  async function buy(offer: PlanOffer) {
    if (!user) return;
    setBusy(offer.id);
    setError(null);
    try {
      const ok = await purchase(user.id, offer);
      if (ok) {
        setMessage('Assinatura confirmada! Ativando o Pro na sua biblioteca…');
        await waitForPro();
        setMessage('Pronto: sua biblioteca agora é Pro.');
      }
    } catch {
      setError('Não foi possível concluir a compra. Nenhum valor foi cobrado.');
    } finally {
      setBusy(null);
    }
  }

  async function restorePurchases() {
    if (!user) return;
    setBusy('restore');
    setError(null);
    try {
      const active = await restore(user.id);
      setMessage(
        active ? 'Assinatura encontrada. Atualizando…' : 'Nenhuma assinatura ativa nesta conta.',
      );
      if (active) await waitForPro();
    } catch {
      setError('Não foi possível verificar as compras agora.');
    } finally {
      setBusy(null);
    }
  }

  async function manage() {
    if (!user) return;
    const url = await managementUrl(user.id).catch(() => null);
    if (url) Linking.openURL(url);
    else setMessage('Gerencie a assinatura nas configurações da loja onde ela foi feita.');
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Planos' }} />
      <Screen edges={[]}>
        <Card className="gap-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Label>Plano atual</Label>
              <Text className="text-2xl font-semibold text-ink">
                {usage.data?.plan_name ?? '—'}
              </Text>
            </View>
            {isPro ? <Icon name="sparkles" size={28} color="accent" /> : null}
          </View>
          {usage.data ? (
            <>
              <UsageRow
                label="Livros no acervo"
                used={usage.data.books}
                max={usage.data.max_books}
              />
              <UsageRow
                label="Pessoas na família"
                used={usage.data.members}
                max={usage.data.max_members}
              />
            </>
          ) : (
            <ActivityIndicator color={palette.accent} />
          )}
        </Card>

        <View className="gap-2">
          <Subheading>Gratuito × Pro</Subheading>
          <Card flush>
            <View className="flex-row border-b border-line px-4 py-2">
              <Text className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted">
                {' '}
              </Text>
              <Text className="w-24 text-center text-xs font-semibold uppercase tracking-wider text-muted">
                Gratuito
              </Text>
              <Text className="w-24 text-center text-xs font-semibold uppercase tracking-wider text-accent">
                Pro
              </Text>
            </View>
            {features.map((f) => (
              <View
                key={f.label}
                className="min-h-[48px] flex-row items-center border-b border-line px-4 py-2">
                <Text className="flex-1 text-sm text-ink">{f.label}</Text>
                <Text className="w-24 text-center text-sm text-muted">{f.free}</Text>
                <Text className="w-24 text-center text-sm font-semibold text-ink">{f.pro}</Text>
              </View>
            ))}
          </Card>
          <Muted>
            Os limites do plano gratuito valem para a biblioteca inteira (a família toda).
          </Muted>
        </View>

        {!isOwner ? (
          <Card>
            <Body>Só quem é dono da biblioteca pode assinar. O Pro vale para toda a família.</Body>
          </Card>
        ) : !isBillingConfigured() ? (
          <Card className="gap-1">
            <Body className="font-semibold">Assinaturas ainda não disponíveis</Body>
            <Muted>
              {billingChannel === 'web'
                ? 'A cobrança pela web ainda não foi configurada.'
                : 'A cobrança pela loja ainda não foi configurada neste app.'}
            </Muted>
          </Card>
        ) : isPro ? (
          <View className="gap-3">
            <Button
              title="Gerenciar assinatura"
              variant="secondary"
              icon="settings-outline"
              onPress={manage}
            />
          </View>
        ) : (
          <View className="gap-3">
            {offers.isPending ? <ActivityIndicator color={palette.accent} /> : null}
            {offers.isError ? <Muted>Não foi possível carregar os preços agora.</Muted> : null}
            {(offers.data ?? []).map((offer, i) => (
              <Button
                key={offer.id}
                title={`Assinar ${offer.price} ${PERIOD_LABELS[offer.period]}`.trim()}
                variant={i === 0 ? 'primary' : 'secondary'}
                icon={i === 0 ? 'sparkles-outline' : undefined}
                loading={busy === offer.id}
                disabled={busy !== null}
                onPress={() => buy(offer)}
              />
            ))}
            <Button
              title="Restaurar compras"
              variant="ghost"
              loading={busy === 'restore'}
              disabled={busy !== null}
              onPress={restorePurchases}
            />
            <Muted className="text-center">
              {billingChannel === 'web'
                ? 'Pagamento seguro com cartão. Cancele quando quiser.'
                : 'A assinatura renova automaticamente e pode ser cancelada nas configurações da loja.'}
            </Muted>
          </View>
        )}

        {message ? (
          <Card className="flex-row items-center gap-3">
            <Icon name="checkmark-circle" color="success" />
            <Body className="flex-1">{message}</Body>
          </Card>
        ) : null}
        {error ? <Body className="text-danger">{error}</Body> : null}
      </Screen>
    </>
  );
}

function UsageRow({ label, used, max }: { label: string; used: number; max: number | null }) {
  const level = usageLevel(used, max);
  return (
    <View className="gap-1.5">
      <View className="flex-row justify-between">
        <Text className="text-sm text-ink">{label}</Text>
        <Text className={`text-sm ${level.nearLimit ? 'font-semibold text-danger' : 'text-muted'}`}>
          {max === null ? `${used} · ilimitado` : `${used} de ${max}`}
        </Text>
      </View>
      {level.fraction !== null ? (
        <ProgressBar value={level.fraction} accessibilityLabel={label} />
      ) : null}
    </View>
  );
}
