import type { ProjectId } from '@/entities/project';
import { type SourceId, useFetchSources, useSourcesSnapshot } from '@/entities/source';
import { AddSourceButton } from '@/features/manage-source';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { VirtualizedGrid } from '@/shared/ui/VirtualizedGrid';
import { SourceItem } from '@/widgets/source-grid';

type Props = {
  projectId: ProjectId;
};

export const Sources = ({ projectId }: Props) => {
  useFetchSources(projectId);

  const sourceIds = useSourcesSnapshot(projectId);

  return (
    <>
      <VirtualizedGrid<SourceId>
        items={sourceIds}
        overscan={2}
        minItemWidth={320}
        className="scrollable h-full min-h-0 w-full p-2 pt-2.5 pb-0"
        getItemKey={(sourceId) => sourceId}
        itemHeight={(itemWidth) => Math.ceil((itemWidth * 9) / 16) + 55}
        renderItem={(sourceId) => <SourceItem key={sourceId} sourceId={sourceId} />}
      />
      {!sourceIds.length && (
        <StatusMessage className="-mt-4" status="regular" iconId="project" iconSize={48}>
          <span>No sources in this project yet</span>
          <AddSourceButton projectId={projectId} />
        </StatusMessage>
      )}
    </>
  );
};
