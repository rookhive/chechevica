import clsx from 'clsx';
import { Button, type Props as ButtonProps } from '@/shared/ui/Button';

type SelectorItem<T extends string> = {
  id: T;
  iconId: ButtonProps['iconId'];
  label: string;
  description: string;
  isDisabled?: boolean;
  onClick: () => void;
};

type Props<T extends string> = {
  selectedItem?: T;
  items: SelectorItem<T>[];
};

export const SearchModeSelector = <T extends string>({ selectedItem, items }: Props<T>) => {
  return (
    <div className="relative">
      {items.map((item) => (
        <Button
          key={item.id}
          iconId={item.iconId}
          iconSize={20}
          isDisabled={item.isDisabled}
          className={clsx(
            'h-8 bg-transparent hover:bg-[unset]',
            item.id === selectedItem && 'bg-emerald-600/30!'
          )}
          tooltip={item.description}
          tooltipStatus="regular"
          tooltipPosition="bottom"
          onClick={item.onClick}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
};
