import clsx from 'clsx';
import type { PropsWithChildren, ReactNode } from 'react';

type Props = {
  title?: string;
  description?: ReactNode;
  isEmpasized?: boolean;
};

export const SettingsSection = ({
  title,
  description,
  children,
  isEmpasized = true,
}: PropsWithChildren<Props>) => {
  return (
    <div
      className={clsx(
        'flex grow select-text flex-col gap-2 rounded-3xl px-5 py-4 transition duration-200 ease-linear',
        isEmpasized && 'hover:bg-white/5'
      )}
    >
      {!!title && (
        <div className="pt-1 font-semibold text-white text-xs uppercase after:mt-2 after:block after:h-1 after:w-10 after:rounded-md after:bg-emerald-700 after:content-['']">
          {title}
        </div>
      )}
      {!!description && <div className="pt-2 text-[0.8rem] text-white/80">{description}</div>}
      <div className="flex flex-wrap items-center gap-2 py-2">{children}</div>
    </div>
  );
};
