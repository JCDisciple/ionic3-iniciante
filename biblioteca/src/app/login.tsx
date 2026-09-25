import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Body, Heading, Muted } from '@/components/ui/typography';
import { sendMagicLink, signInWithGoogle } from '@/lib/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleMagicLink() {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Digite um e-mail válido.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await sendMagicLink(email);
      setSentTo(email.trim().toLowerCase());
    } catch {
      setError('Não foi possível enviar o link. Tente novamente em instantes.');
    } finally {
      setSending(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setError('Não foi possível entrar com o Google.');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 justify-center gap-8 py-8">
          <View className="items-center gap-3">
            <View className="h-20 w-20 items-center justify-center rounded-3xl bg-accent">
              <Icon name="library" size={40} color="onAccent" />
            </View>
            <Heading size="xl" className="text-center">
              Biblioteca
            </Heading>
            <Muted className="max-w-xs text-center text-base">
              Seu acervo e suas leituras, da estante ao Kindle, num só lugar.
            </Muted>
          </View>

          {sentTo ? (
            <Card className="items-center gap-3 py-6">
              <Icon name="mail-open-outline" size={36} color="accent" />
              <Body className="text-center font-semibold">Confira seu e-mail</Body>
              <Muted className="text-center">
                Enviamos um link de acesso para {sentTo}. Abra-o neste aparelho para entrar.
              </Muted>
              <Button title="Usar outro e-mail" variant="ghost" onPress={() => setSentTo(null)} />
            </Card>
          ) : (
            <View className="gap-4">
              <TextField
                label="E-mail"
                placeholder="voce@exemplo.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                inputMode="email"
                returnKeyType="send"
                onSubmitEditing={handleMagicLink}
                error={error}
              />
              <Button
                title="Receber link de acesso"
                icon="mail-outline"
                loading={sending}
                onPress={handleMagicLink}
              />
              <View className="flex-row items-center gap-3">
                <View className="h-px flex-1 bg-line" />
                <Muted>ou</Muted>
                <View className="h-px flex-1 bg-line" />
              </View>
              <Button
                title="Entrar com Google"
                icon="logo-google"
                variant="secondary"
                loading={googleLoading}
                onPress={handleGoogle}
              />
            </View>
          )}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
