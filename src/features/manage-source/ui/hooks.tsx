import { useMemo } from 'react';
import { useSnapshot } from 'valtio';
import { type SourceId, useDeleteSource } from '@/entities/source';
import type { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { dialog } from '@/shared/ui/Dialog';
import type { ImportStore } from '../model/importStore';
import { useOpenCancelProcessingDialog } from './CancelProcessingDialog';
import { DeleteSourceMessage } from './DeleteSourceMessage';
import { openReprocessSourceModal } from './ReprocessSourceModal';

export const useCancelProcessingMenuItem = (sourceId: SourceId) => {
  const openCancelProcessingDialog = useOpenCancelProcessingDialog();
  return useMemo<ContextMenuItem>(
    () => ({
      id: 'cancel-processing',
      label: 'Cancel processing',
      iconId: 'clear',
      status: 'dangerous',
      onClick: () => openCancelProcessingDialog(sourceId),
    }),
    [openCancelProcessingDialog, sourceId]
  );
};

export const useDeleteSourceMenuItem = (sourceId: SourceId) => {
  const deleteSource = useDeleteSource();
  return useMemo<ContextMenuItem>(
    () => ({
      id: 'delete',
      label: 'Delete source',
      iconId: 'trash',
      status: 'dangerous',
      onClick: () => {
        dialog.open({
          title: 'Confirm deletion',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          confirmButtonStatus: 'dangerous',
          children: <DeleteSourceMessage sourceId={sourceId} />,
          onConfirm: () => deleteSource({ sourceId }),
        });
      },
    }),
    [deleteSource, sourceId]
  );
};

export const useReprocessSourceMenuItem = (sourceId: SourceId) => {
  return useMemo<ContextMenuItem>(
    () => ({
      id: 'reprocess-source',
      label: 'Reprocess source',
      iconId: 'restart',
      onClick: () => openReprocessSourceModal(sourceId),
    }),
    [sourceId]
  );
};

export const useSourceImportStore = (store: ImportStore) => {
  return useSnapshot(store.state);
};
