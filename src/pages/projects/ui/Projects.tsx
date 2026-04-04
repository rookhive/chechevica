import type { ProjectInfo } from '@/entities/project';
import { VirtualizedGrid } from '@/shared/ui/VirtualizedGrid';
import { ProjectItem } from './ProjectItem';

type Props = {
  projects: ProjectInfo[];
};

export const Projects = ({ projects }: Props) => {
  return (
    <VirtualizedGrid<ProjectInfo>
      items={projects}
      overscan={3}
      className="scrollable h-full min-h-0 p-2 pt-2.5 pb-0"
      minItemWidth={380}
      getItemKey={(projectInfo) => projectInfo.project.id}
      itemHeight={(itemWidth) => Math.ceil((itemWidth * 9) / 16)}
      renderItem={(projectInfo) => <ProjectItem projectInfo={projectInfo} />}
    />
  );
};
