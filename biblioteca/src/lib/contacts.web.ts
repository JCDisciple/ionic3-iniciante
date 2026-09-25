export type PickedContact = { name: string; phone: string | null };

type ContactsManager = {
  select: (
    props: ('name' | 'tel')[],
    options?: { multiple?: boolean },
  ) => Promise<{ name?: string[]; tel?: string[] }[]>;
};

function manager(): ContactsManager | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { contacts?: ContactsManager }).contacts ?? null;
}

/** Contact Picker API (Chrome no Android). Em outros navegadores, digita-se. */
export const canPickContact = () => manager() !== null;

export async function pickContact(): Promise<PickedContact | null> {
  const contacts = manager();
  if (!contacts) return null;
  const [picked] = await contacts.select(['name', 'tel'], { multiple: false });
  if (!picked) return null;
  return { name: picked.name?.[0] ?? '', phone: picked.tel?.[0] ?? null };
}
