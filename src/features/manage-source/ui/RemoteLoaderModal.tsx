import type { SubmitEvent } from 'react';
import { useSnapshot } from 'valtio';
import { Button } from '@/shared/ui/Button';
import { ExternalLink } from '@/shared/ui/ExternalLink';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';
import type { ImportStore } from '../model/importStore';

export const RemoteLoaderModal = ({ store }: { store: ImportStore }) => {
  const { remoteCandidates, isRemoteLoaderOpen, remoteLink, isRemoteLoading, remoteError } =
    useSnapshot(store.state);
  const canFetch = !!remoteLink.trim() && !isRemoteLoading;
  const canAdd = remoteCandidates.length > 0 && !isRemoteLoading;

  const handleFetch = async () => {
    await store.fetchRemoteCandidates();
  };

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!canFetch) return;
    void handleFetch();
  };

  const handleAddVideos = () => {
    store.addRemoteItems(remoteCandidates.slice());
    store.resetRemoteLoader();
    store.closeRemoteLoader();
  };

  return (
    <Modal isOpen={isRemoteLoaderOpen} title="Add remote videos" onClose={store.closeRemoteLoader}>
      <form className="flex w-140 flex-col gap-3" onSubmit={handleSubmit}>
        <Input
          autoFocus
          iconId="youtube"
          value={remoteLink}
          placeholder="Enter YouTube link (video, channel, or playlist)"
          isLoading={isRemoteLoading}
          onChange={store.setRemoteLink}
        />
        {!!remoteError && <div className="text-red-400 text-sm">{remoteError}</div>}
        {!!remoteCandidates.length && (
          <div className="scrollable -mx-3 flex max-h-80 flex-col gap-2 pr-1">
            {remoteCandidates.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className="flex items-center gap-2 rounded-full p-1 transition-colors duration-200 ease-linear hover:bg-white/5"
              >
                <ExternalLink href={item.url} className="p-2" title="Open this video on YouTube" />
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
        {!!remoteCandidates.length && (
          <div className="flex items-center justify-end">
            <Button isDisabled={!canAdd} status="success" isUppercased onClick={handleAddVideos}>
              Add these videos
            </Button>
          </div>
        )}
      </form>
    </Modal>
  );
};
