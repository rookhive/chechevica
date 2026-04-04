import { open } from '@tauri-apps/plugin-dialog';
import { type MouseEvent, useMemo, useState } from 'react';
import type { Patch } from '@/shared/contract/Patch';
import type { Option } from '@/shared/types/common';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Thumbnail } from '@/shared/ui/Thumbnail';

type Props = {
  initialTitle?: Option<string>;
  initialThumbnail?: Option<string>;
  submitLabel: string;
  onSubmit: (payload: { title: string; thumbnailPatch: Patch<string> }) => Promise<void>;
};

export const ProjectForm = ({ initialTitle, initialThumbnail, submitLabel, onSubmit }: Props) => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [projectTitle, setProjectTitle] = useState(initialTitle ?? '');
  const [thumbnail, setThumbnail] = useState(initialThumbnail ?? '');
  const [thumbnailPatch, setThumbnailPatch] = useState<Patch<string>>({ type: 'unchanged' });
  const isValidated = useMemo(() => projectTitle?.trim().length > 0, [projectTitle]);

  const handleSelectThumbnail = async () => {
    const selected = await open({
      title: 'Select project thumbnail',
      multiple: false,
      directory: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
    });

    if (!selected || Array.isArray(selected)) return;

    setThumbnail(selected);
    setThumbnailPatch({ type: 'set', value: selected });
  };

  const handleClearThumbnail = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setThumbnail('');
    setThumbnailPatch({ type: 'remove' });
  };

  const handleSubmit = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    await onSubmit({ title: projectTitle, thumbnailPatch });
    setIsSubmitted(true);
  };

  return (
    <div className="flex w-110 flex-col items-start gap-2.5">
      <div
        className="group/project-form relative aspect-video w-full cursor-pointer overflow-hidden rounded-2xl ring-1 ring-neutral-800/60"
        onClick={handleSelectThumbnail}
      >
        <Thumbnail path={thumbnail} iconId="project" iconSize={60} />
        {!thumbnail && (
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-9 rounded-full px-2.5 py-0.5 text-white/50 transition duration-300 group-hover/project-form:bg-white/5">
            <span className="text-xs">Select project thumbnail..</span>
          </span>
        )}
        {thumbnail && (
          <div className="absolute right-2 bottom-2 rounded-full bg-black/70 text-white">
            <Button
              iconId="trash"
              iconSize={22}
              className="bg-transparent"
              tooltip="Remove thumbnail"
              tooltipPosition="top"
              onClick={handleClearThumbnail}
            />
          </div>
        )}
      </div>
      <Input
        autoFocus
        className="w-full"
        value={projectTitle}
        placeholder="Enter project name.."
        onChange={setProjectTitle}
      />
      <Button
        className="ml-auto"
        isDisabled={isSubmitted || !isValidated}
        isUppercased
        status={isValidated ? 'success' : 'regular'}
        onClick={isSubmitted ? undefined : handleSubmit}
      >
        {submitLabel}
      </Button>
    </div>
  );
};
