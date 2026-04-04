import { useEffect } from 'react';
import type { Props as IconProps } from '@/shared/ui/Icon';
import { useTab } from './useTab';

type TabMetainfo = {
  title: string;
  icon: IconProps['id'];
  isLoading: boolean;
};

export const useTabMetainfo = (metainfo: Partial<TabMetainfo>) => {
  const { setTitle, setIcon, setIsLoading } = useTab();

  useEffect(() => {
    if (metainfo.title !== undefined) setTitle(metainfo.title);
  }, [setTitle, metainfo.title]);

  useEffect(() => {
    if (metainfo.icon !== undefined) setIcon(metainfo.icon);
  }, [setIcon, metainfo.icon]);

  useEffect(() => {
    if (metainfo.isLoading !== undefined) setIsLoading(metainfo.isLoading);
  }, [setIsLoading, metainfo.isLoading]);
};
