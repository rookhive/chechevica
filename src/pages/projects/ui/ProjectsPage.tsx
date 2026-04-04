import { useProjects } from '@/entities/project';
import { AddProjectButton } from '@/features/manage-project';
import { useTabMetainfo } from '@/features/manage-tabs';
import { StatusMessage } from '@/shared/ui/StatusMessage';
import { Projects } from './Projects';

export const ProjectsPage = () => {
  const { data: projects } = useProjects();

  useTabMetainfo({ icon: 'projects', title: 'Projects' });

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <Projects projects={projects} />
      </div>
      {!projects.length && (
        <StatusMessage className="-mt-4" status="regular" iconId="projects" iconSize={48}>
          <span>No projects yet</span>
          <AddProjectButton />
        </StatusMessage>
      )}
    </>
  );
};
