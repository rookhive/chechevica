import { type MouseEvent, useMemo, useRef } from 'react';
import { Link } from 'wouter';
import { openInNewTabMenuItem, useTabMetainfo } from '@/features/manage-tabs';
import { Animated } from '@/shared/ui/Animated';
import { ContextMenu } from '@/shared/ui/ContextMenu';
import { Icon, type Props as IconProps } from '@/shared/ui/Icon';
import { RippleEffect } from '@/shared/ui/RippleEffect';

type Item = {
  icon: IconProps['id'];
  label: string;
  href: string;
  onClick?: (e: MouseEvent) => void;
};

export const NewTabPage = () => {
  useTabMetainfo({ icon: 'new-tab', title: 'New Tab' });

  const items: Item[] = useMemo(
    () => [
      {
        icon: 'projects',
        label: 'Projects',
        href: '/projects',
      },
      {
        icon: 'settings',
        label: 'Settings',
        href: '/settings',
      },
      {
        icon: 'job',
        label: 'Processing Sources',
        href: '/processing-sources',
      },
    ],
    []
  );

  return (
    <Animated className="flex h-full max-w-full items-center justify-center">
      <div className="flex flex-wrap items-center justify-center gap-4">
        {items.map((item) => (
          <ItemButton key={item.href} item={item} />
        ))}
      </div>
    </Animated>
  );
};

const ItemButton = ({ item }: { item: Item }) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const { href, icon, label, onClick } = item;
  const contextMenuItems = useMemo(() => [openInNewTabMenuItem(href)], [href]);

  return (
    <Link
      ref={linkRef}
      key={href}
      href={href}
      className="relative flex aspect-video w-60 max-w-full items-center justify-center gap-2 rounded-4xl bg-emerald-900/30 p-3 px-5 text-emerald-500 transition-colors duration-300 ease-linear hover:bg-emerald-950"
      onClick={onClick}
    >
      <RippleEffect ref={linkRef} color="bg-emerald-700/20" />
      <Icon id={icon} className="size-10 shrink-0 rounded-full bg-white/5 p-2" size={22} />
      <span className="text-nowrap text-base">{label}</span>
      <ContextMenu anchor={linkRef} items={contextMenuItems} />
    </Link>
  );
};
