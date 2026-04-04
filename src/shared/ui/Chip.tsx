export type Props = {
  label: string;
  value: string | number;
};

export const Chip = ({ label, value }: Props) => {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-lg bg-emerald-300/10 px-2 py-1 text-emerald-500">
      <span className="opacity-70">{label}</span>
      <span className="ml-0.5 font-semibold">{String(value)}</span>
    </span>
  );
};
