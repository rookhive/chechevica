import { useMemo } from 'react';
import { useSourceArtifact } from '@/entities/artifact';
import { useSourceSnapshot } from '@/entities/source';
import { useSourceId } from '@/features/view-source';
import { formatBytes } from '@/shared/lib/file';
import { formatSeconds } from '@/shared/lib/time';
import { ExternalLink } from '@/shared/ui/ExternalLink';
import { Icon } from '@/shared/ui/Icon';
import { LiveTimeDistance } from '@/shared/ui/LiveTimeDistance';
import { SourceControls } from './SourceControls';

export const SourceDetails = () => {
  const sourceId = useSourceId();
  const source = useSourceSnapshot(sourceId);
  const { artifact } = useSourceArtifact({ sourceId });

  const details = useMemo(
    () => [
      {
        label: source.kind === 'local' ? 'Created' : 'Published',
        value: <LiveTimeDistance date={source.originCreatedAt} />,
      },
      { label: 'Imported', value: <LiveTimeDistance date={source.createdAt} /> },
      { label: 'Duration', value: formatSeconds(source.duration) },
      { label: 'Size', value: artifact ? formatBytes(artifact.size) : null },
    ],
    [source, artifact]
  );

  return (
    <>
      {source.kind === 'remote' ? <YoutubeSourceDetails /> : <LocalSourceDetails />}
      <div className="flex">
        <div className="flex w-10 shrink-0 justify-center">
          <div className="h-full w-0 border-white/15 border-r border-dashed lg:invisible" />
        </div>
        <div className="flex min-w-0 flex-col items-start gap-3 py-2">
          <ul className="flex grow flex-col gap-1 self-stretch px-0 pl-2">
            {details.map(({ label, value }) => (
              <li key={label} className="flex gap-3">
                <span className="w-12 shrink-0 text-neutral-500 text-xs">{label}</span>
                <span className="truncate text-neutral-400 text-xs">{value}</span>
              </li>
            ))}
          </ul>
          <SourceControls />
        </div>
      </div>
    </>
  );
};

const LocalSourceDetails = () => {
  const source = useSourceSnapshot(useSourceId());
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center rounded-full border border-white/15 border-dashed bg-white/5 p-2 text-white">
        <Icon id={source.mediaType} size={22} />
      </div>
      <div>Local {source.mediaType.toLowerCase()}</div>
    </div>
  );
};

const YoutubeSourceDetails = () => {
  const source = useSourceSnapshot(useSourceId());
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center rounded-full border border-white/15 border-dashed bg-white/5 p-2 text-red-400">
        <Icon id="youtube" size={22} />
      </div>
      <div>YouTube {source.mediaType.toLowerCase()}</div>
      {source.origin && (
        <ExternalLink
          className="p-2"
          href={source.origin}
          tooltip="Open original source on YouTube"
        />
      )}
    </div>
  );
};
