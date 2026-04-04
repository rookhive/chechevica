import type { ProjectId } from '@/entities/project';
import { Button } from '@/shared/ui/Button';
import { modal } from '@/shared/ui/Modal';
import { SourceLoader } from './SourceLoader';

type Props = {
  projectId: ProjectId;
};

export const AddSourceButton = ({ projectId }: Props) => {
  const handleOpen = () => {
    modal.open({
      title: 'Source loader',
      closeOnBackdropClick: false,
      children: ({ close }) => <SourceLoader projectId={projectId} onComplete={close} />,
    });
  };

  return (
    <Button iconId="add" status="success" isUppercased onClick={handleOpen}>
      Add sources
    </Button>
  );
};
