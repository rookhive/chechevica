import { motion } from 'motion/react';
import { memo, useMemo, useRef } from 'react';
import { Link } from 'wouter';
import type { ProjectInfo } from '@/entities/project';
import { useDeleteProjectMenuItem, useUpdateProjectMenuItem } from '@/features/manage-project';
import { openInNewTabMenuItem } from '@/features/manage-tabs';
import { ContextMenu, type ContextMenuItem } from '@/shared/ui/ContextMenu';
import { Icon } from '@/shared/ui/Icon';
import { Thumbnail } from '@/shared/ui/Thumbnail';

type Props = {
  projectInfo: ProjectInfo;
};

export const ProjectItem = memo(({ projectInfo: { project, sourcesCount } }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const href = `/project/${project.id}`;
  const updateProjectMenuItem = useUpdateProjectMenuItem(project.id);
  const deleteProjectMenuItem = useDeleteProjectMenuItem(project.id);

  const contextMenuItems = useMemo<ContextMenuItem[]>(
    () => [openInNewTabMenuItem(href), updateProjectMenuItem, deleteProjectMenuItem],
    [updateProjectMenuItem, deleteProjectMenuItem, href]
  );

  return (
    <>
      <motion.div
        ref={containerRef}
        layout="position"
        className="w-full"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <Link href={href} className="group/project-item relative w-full">
          <div className="pointer-events-none absolute -inset-2 scale-85 rounded-t-3xl rounded-b-2xl bg-emerald-900/75 opacity-0 transition-[transform,opacity,scale] duration-350 will-change-[transform,opacity,scale] contain-strict content-[''] group-hover/project-item:scale-100 group-hover/project-item:opacity-100" />
          <div className="relative aspect-video overflow-hidden rounded-2xl ring-1 ring-neutral-800/60">
            <div className="absolute inset-0 transition-transform duration-600 ease-in-out group-hover/project-item:scale-110">
              <Thumbnail path={project.thumbnail} iconId="project" iconSize={64} />
            </div>
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-xl bg-black/75 px-3 py-2 text-sm">
              <Icon id="collection" size={16} />
              <span>{sourcesCount}</span>
            </div>
            <div className="absolute right-2 bottom-2 left-2 flex items-center">
              <div className="inline-flex max-w-full gap-2 rounded-xl bg-black/75 px-3 py-2 text-sm">
                <Icon id="project" size={16} className="mt-0.5 shrink-0" />
                <span className="wrap-break-word min-w-0">{project.title}</span>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
      <ContextMenu anchor={containerRef} items={contextMenuItems} />
    </>
  );
});
