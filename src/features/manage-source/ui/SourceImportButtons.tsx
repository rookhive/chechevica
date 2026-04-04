import { open } from '@tauri-apps/plugin-dialog';
import clsx from 'clsx';
import { useMemo } from 'react';
import { Button } from '@/shared/ui/Button';
import type { ImportStore } from '../model/importStore';

type Props = {
  className?: string;
  store: ImportStore;
};

export const SourceImportButtons = ({ className, store }: Props) => {
  const mediaFilters = useMemo(
    () => [
      {
        name: 'Media',
        extensions: [
          'mp4',
          'mkv',
          'webm',
          'wav',
          'm4a',
          'flac',
          'ogg',
          'a64',
          'avi',
          'avs2',
          'cavsvideo',
          'cdxl',
          'd',
          'dhav',
          'dv',
          'dvd',
          'evc',
          'f4v',
          'ffmetadata',
          'flv',
          'gdv',
          'h264',
          'hevc',
          'ipmovie',
          'ipod',
          'ipu',
          'iv8',
          'ivr',
          'live',
          'luodat',
          'm4v',
          'mov',
          'matroska',
          'mjpeg',
          'aac',
          'alac',
          'mlv',
          'mp2',
          'mp3',
          'mp4',
          'mpeg',
          'mpeg1video',
          'mpeg2video',
          'mpegts',
          'mpegtsraw',
          'mpegvideo',
          'mv',
          'nsv',
          'null',
          'nuv',
          'ogv',
          'pdv',
          'psp',
          'rawvideo',
          'rpl',
          'rtp',
          'ser',
          'svcd',
          'vc1',
          'vcd',
          'vob',
          'vvc',
          'wc3movie',
          'yuv4mpegpipe',
        ],
      },
    ],
    []
  );

  const handleSelectLocalFiles = async () => {
    const selected = await open({
      title: 'Select local media files',
      multiple: true,
      directory: false,
      filters: mediaFilters,
    });

    const selectedPaths = (selected ?? []) as string[];
    store.addLocalPaths(selectedPaths);
  };

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <Button iconId="add" isUppercased onClick={handleSelectLocalFiles}>
        Add local files
      </Button>
      <Button
        iconId="youtube"
        className="pl-3"
        iconSize={20}
        isUppercased
        onClick={store.openRemoteLoader}
      >
        Add remote videos
      </Button>
    </div>
  );
};
