import {
  type SourceId,
  useFetchProcessingSources,
  useProcessingSourceIdsSnapshot,
} from '@/entities/source';
import { useTabMetainfo } from '@/features/manage-tabs';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { VirtualizedGrid } from '@/shared/ui/VirtualizedGrid';
import { SourceItem } from '@/widgets/source-grid';

export const ProcessingSourcesPage = () => {
  useTabMetainfo({ icon: 'job', title: 'Processing Sources' });

  const { isLoading } = useFetchProcessingSources();
  const sourceIds = useProcessingSourceIdsSnapshot();

  if (isLoading && !sourceIds.length) return null;

  return (
    <>
      <VirtualizedGrid<SourceId>
        items={sourceIds}
        minItemWidth={320}
        className="scrollable h-full min-h-0 w-full p-2 pt-2.5 pb-0"
        getItemKey={(sourceId) => sourceId}
        itemHeight={(itemWidth) => Math.ceil((itemWidth * 9) / 16) + 55}
        renderItem={(sourceId) => <SourceItem key={sourceId} sourceId={sourceId} />}
      />
      {!sourceIds.length && (
        <StatusMessage
          className="-mt-4"
          status="success"
          iconId="check"
          linkMessage="Go to Projects"
          linkHref="/projects"
        >
          There are no processing sources
        </StatusMessage>
      )}
    </>
  );
};
