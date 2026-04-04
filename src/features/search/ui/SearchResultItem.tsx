import { useMemo, useRef } from 'react';
import { useSnapshot } from 'valtio';
import { Link } from 'wouter';
import type { Project } from '@/entities/project';
import type { Source } from '@/entities/source';
import { openInNewTabMenuItem } from '@/features/manage-tabs';
import { Animated } from '@/shared/ui/Animated';
import { ContextMenu } from '@/shared/ui/ContextMenu';
import { Icon } from '@/shared/ui/Icon';
import { RippleEffect } from '@/shared/ui/RippleEffect';
import { Tooltip } from '@/shared/ui/Tooltip';
import type { SearchHit } from '../model/types';
import { useSearchStore } from './hooks';
import { SearchHighlighter } from './SearchHighlighter';

type Props = {
  searchHit: SearchHit;
  onNavigate: () => void;
};

export const SearchResultItem = ({ searchHit, onNavigate }: Props) => {
  const { state } = useSearchStore();
  const { searchResults } = useSnapshot(state);
  const { searchMode } = searchResults?.request || {};
  const { project, source, segment, score } = searchHit;
  const segmentRef = useRef<HTMLAnchorElement>(null);
  const link = `/source/${segment.sourceId}?segment=${segment.id}`;
  const contextMenuItems = useMemo(() => [openInNewTabMenuItem(link)], [link]);

  return (
    <Animated className="group relative mx-auto flex w-full max-w-200 flex-col gap-1.5 py-3">
      <div className="flex items-center gap-3 px-2">
        <ProjectItem project={project} onNavigate={onNavigate} />
        <span className="relative -top-px opacity-50">/</span>
        <SourceItem source={source} onNavigate={onNavigate} />
        {searchMode === 'semantic' && (
          <div className="ml-auto">
            <Points score={score} />
          </div>
        )}
      </div>
      <Link
        key={segment.id}
        ref={segmentRef}
        href={link}
        className="relative px-4 py-3"
        draggable={false}
        onClick={onNavigate}
      >
        <div className="absolute inset-0 rounded-2xl bg-emerald-900/50 transition-all duration-500 ease-out will-change-[transform,opacity,scale] contain-strict hover:bg-emerald-900/90!">
          <RippleEffect ref={segmentRef} duration={1} color="bg-white/5" />
        </div>
        <div className="wrap-break-word pointer-events-none relative text-sm leading-normal">
          <SearchHighlighter text={segment.text} />
        </div>
        <ContextMenu anchor={segmentRef} items={contextMenuItems} />
      </Link>
    </Animated>
  );
};

const ProjectItem = ({ project, onNavigate }: { project: Project; onNavigate: () => void }) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const link = `/project/${project.id}`;
  const contextMenuItems = useMemo(() => [openInNewTabMenuItem(link)], [link]);
  return (
    <Link
      ref={linkRef}
      href={link}
      className="flex min-w-0 items-center gap-1.5"
      onClick={onNavigate}
    >
      <Icon id="project" size={20} className="shrink-0" />
      <span className="truncate text-xs">{project.title}</span>
      <ContextMenu anchor={linkRef} items={contextMenuItems} />
    </Link>
  );
};

const SourceItem = ({ source, onNavigate }: { source: Source; onNavigate: () => void }) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const link = `/source/${source.id}`;
  const contextMenuItems = useMemo(() => [openInNewTabMenuItem(link)], [link]);
  const iconId = source.kind === 'remote' ? 'youtube' : source.mediaType;
  return (
    <Link
      ref={linkRef}
      href={link}
      className="flex min-w-0 items-center gap-1.5"
      onClick={onNavigate}
    >
      <Icon id={iconId} size={20} className="shrink-0" />
      <span className="truncate text-xs">{source.title}</span>
      <ContextMenu anchor={linkRef} items={contextMenuItems} />
    </Link>
  );
};

const Points = ({ score }: { score: number }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrapperRef} className="flex cursor-default items-center gap-0.5">
      <Icon id="star" size={20} className="mb-px text-yellow-400" />
      <span className="text-xs">{score}</span>
      <Tooltip anchorRef={wrapperRef} position="top">
        Search score: higher is better
      </Tooltip>
    </div>
  );
};
