export type DateFieldProps = {
  label: string;
  /** AAAA-MM-DD ou null. */
  value: string | null;
  onChange: (value: string | null) => void;
  min?: string;
  max?: string;
  hint?: string;
};
