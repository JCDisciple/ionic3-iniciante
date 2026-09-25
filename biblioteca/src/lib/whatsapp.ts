import { formatDate } from '@/lib/dates';

/** Só dígitos; números sem DDI (sem "+" e com 10–11 dígitos) são tratados como do Brasil. */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (phone.trim().startsWith('+')) return digits;
  const local = digits.replace(/^0+/, '');
  return local.length <= 11 ? `55${local}` : local;
}

export function reminderText(params: {
  borrower: string;
  title: string;
  lentAt: string;
  dueAt: string | null;
}) {
  const firstName = params.borrower.split(' ')[0];
  const when = params.dueAt
    ? `combinamos a devolução para ${formatDate(params.dueAt)}`
    : `ele está com você desde ${formatDate(params.lentAt)}`;
  return `Oi, ${firstName}! Tudo bem? Passando para lembrar do livro “${params.title}” — ${when}. Quando puder, me devolve? Obrigado! 📚`;
}

/** Link wa.me com a mensagem pronta (sem telefone, o WhatsApp pede o contato). */
export function whatsappUrl(phone: string | null, text: string): string {
  const number = phone ? normalizePhone(phone) : null;
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`;
}
