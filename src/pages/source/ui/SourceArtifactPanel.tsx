import { useStepParameters } from '@/entities/source';
import { SourceProgressOverlay } from '@/features/source-progress';
import { SourcePlayer } from '@/widgets/source-player';
import { SourceProcessingDetails } from '@/widgets/source-processing-details';
import { SourceDetails } from './SourceDetails';
import { SourceTitlebar } from './SourceTitlebar';

export const SourceArtifactPanel = () => {
  useStepParameters();

  return (
    <div className="flex h-full gap-2 p-3 pr-1 pb-0 lg:h-full lg:flex-col">
      <div className="relative">
        <SourcePlayer />
        <SourceProgressOverlay />
      </div>
      <div className="flex min-h-0 grow select-text flex-col overflow-y-scroll lg:overflow-y-visible">
        <div className="p-2 pt-0 pl-0">
          <SourceTitlebar />
        </div>
        <div className="flex flex-col lg:min-h-25 lg:flex-row lg:gap-2 lg:overflow-y-scroll">
          <div className="lg:w-2/5 lg:min-w-50">
            <SourceDetails />
          </div>
          <div className="px-2 lg:-mt-px lg:px-0 lg:py-3">
            <SourceProcessingDetails />
          </div>
        </div>
      </div>
    </div>
  );
};
