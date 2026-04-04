import { useLocation } from 'wouter';
import { useTabMetainfo } from '@/features/manage-tabs';
import { StatusMessage } from '@/shared/ui/StatusMessage';

export const NotFoundPage = () => {
  const [location] = useLocation();

  useTabMetainfo({ icon: 'error', title: 'Page Not Found' });

  return (
    <StatusMessage
      iconId="error"
      iconSize={42}
      status="dangerous"
      linkHref="/projects"
      linkMessage="Go to Projects"
    >
      <div className="text-lg">How did you end up here?</div>
      <div className="mb-1 text-neutral-200 text-sm">
        Page <code className="rounded-lg bg-emerald-950 px-2 py-1 text-sm">{location}</code> doesn't
        exist
      </div>
    </StatusMessage>
  );
};
