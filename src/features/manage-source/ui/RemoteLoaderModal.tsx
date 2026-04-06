import { useSnapshot } from 'valtio';
import { Button } from '@/shared/ui/Button';
import { ExternalLink } from '@/shared/ui/ExternalLink';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';
import type { ImportStore } from '../model/importStore';

export const RemoteLoaderModal = ({ store }: { store: ImportStore }) => {
  const { remoteCandidates, isRemoteLoaderOpen, remoteLink, isRemoteLoading, remoteError } =
    useSnapshot(store.state);
  const hasCandidates = remoteCandidates.length > 0;
  const canFetch = !!remoteLink.trim() && !isRemoteLoading;
  const canAdd = hasCandidates && !isRemoteLoading;

  const handleSubmit = async () => {
    if (!canFetch) return;
    await store.fetchRemoteCandidates();
    store.setRemoteLink('');
  };

  const handleAddVideos = () => {
    store.addRemoteItems(remoteCandidates.slice());
    store.resetRemoteLoader();
    store.closeRemoteLoader();
  };

  return (
    <Modal isOpen={isRemoteLoaderOpen} title="Add remote videos" onClose={store.closeRemoteLoader}>
      <div className="flex w-140 flex-col gap-3">
        <Input
          autoFocus
          iconId="youtube"
          value={remoteLink}
          placeholder="Enter YouTube link (video, channel, or playlist)"
          isDisabled={isRemoteLoading}
          isLoading={isRemoteLoading}
          rightSlot={
            <Button
              className="-mr-1 ml-2"
              status={remoteLink ? 'success' : 'regular'}
              isUppercased
              isDisabled={!remoteLink}
              isLoading={isRemoteLoading}
              onClick={handleSubmit}
            >
              Add
            </Button>
          }
          onChange={store.setRemoteLink}
        />
        {!!remoteError && <div className="text-red-400 text-sm">{remoteError}</div>}
        {hasCandidates && (
          <div className="scrollable -mx-3 flex max-h-80 flex-col gap-2 pr-1">
            {remoteCandidates.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="flex items-center gap-2 rounded-full p-1 transition-colors duration-200 ease-linear hover:bg-white/5"
              >
                <ExternalLink
                  href={item.url}
                  className="p-2"
                  tooltip="Open this video on YouTube"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="wrap-break-word text-sm">{item.title}</span>
                </div>
                <Button
                  className="ml-auto shrink-0"
                  iconId="trash"
                  iconSize={18}
                  tooltip="Remove video"
                  tooltipPosition="top"
                  onClick={() => store.removeRemoteCandidate(index)}
                />
              </div>
            ))}
          </div>
        )}
        {hasCandidates && (
          <div className="flex items-center justify-end">
            <Button
              status={canAdd ? 'success' : 'regular'}
              isDisabled={!canAdd}
              isUppercased
              onClick={handleAddVideos}
            >
              Add these videos
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
