import { Contact } from 'expo-contacts';

export type PickedContact = { name: string; phone: string | null };

/** Abre a agenda do aparelho (nativo). */
export async function pickContact(): Promise<PickedContact | null> {
  const contact = await Contact.presentPicker();
  if (!contact) return null;
  const [name, phones] = await Promise.all([contact.getFullName(), contact.getPhones()]);
  return { name, phone: phones[0]?.number ?? null };
}

export const canPickContact = () => true;
