import clsx from 'clsx';
import { useRef } from 'react';
import type { JobParam } from '@/shared/contract/JobParam';
import { Input } from '@/shared/ui/Input';
import { Select, type SelectItem } from '@/shared/ui/Select';
import { Tooltip } from './Tooltip';

type Props = {
  param: JobParam;
  value: unknown;
  isDisabled?: boolean;
  accentColorClassName?: string;
  onChange: (value: unknown) => void;
};

export const SourceParameterControl = ({
  param,
  value,
  isDisabled,
  accentColorClassName,
  onChange,
}: Props) => {
  const kind = param.kind;

  if ('integer' in kind) {
    return (
      <IntegerParameter
        value={value as string}
        label={param.label}
        min={kind.integer.min}
        max={kind.integer.max}
        isDisabled={isDisabled}
        accentColorClassName={accentColorClassName}
        onChange={onChange}
      />
    );
  }

  const items: SelectItem[] = kind.select.options.map((option) => ({
    id: option,
    label: option,
    onClick: () => onChange(option),
  }));

  return (
    <Select
      className="bg-white/5 hover:bg-white/10"
      items={items}
      selectedId={String(value ?? '')}
      align="end"
      isDisabled={isDisabled}
      renderSelectedItem={(item) => (
        <div className="flex items-center gap-1 truncate">
          {!!accentColorClassName && (
            <span className={clsx('mr-1 size-3 shrink-0 rounded-full', accentColorClassName)} />
          )}
          <span className="text-white/60">{param.label}:</span> {item?.label}
        </div>
      )}
    />
  );
};

const IntegerParameter = ({
  label,
  value,
  min,
  max,
  isDisabled,
  accentColorClassName,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  isDisabled?: boolean;
  accentColorClassName?: string;
  onChange: (value: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBlur = () => {
    const parsedValue = Number.parseInt(value, 10) || 0;
    return onChange(String(Math.max(min, Math.min(max, parsedValue))));
  };

  return (
    <div
      className={clsx(
        'relative inline-flex h-9.5 select-none items-center gap-1 rounded-full bg-white/5 px-3 pr-0 text-white text-xs transition-all duration-350 ease-linear hover:bg-white/10',
        isDisabled && 'pointer-events-none opacity-50'
      )}
    >
      {!!accentColorClassName && (
        <span className={clsx('mr-1 size-3 shrink-0 rounded-full', accentColorClassName)} />
      )}
      <span className="pr-1.5 text-white/60 text-xs">{label}:</span>
      <Input
        inputRef={inputRef}
        className="h-9.5 w-20 rounded-none! rounded-r-full! bg-transparent"
        inputClassName="text-xs"
        value={String(value ?? '')}
        isDisabled={isDisabled}
        onChange={onChange}
        onBlur={handleBlur}
      />
      <Tooltip anchorRef={inputRef} position="top" status="regular">
        Integer from {min} to {max}
      </Tooltip>
    </div>
  );
};
