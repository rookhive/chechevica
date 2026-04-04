import type { MouseEvent, PropsWithChildren, ReactNode } from 'react';
import { Button, type Props as ButtonProps } from './Button';
import { Modal, modal } from './Modal';

export type Props = {
  title: string;
  isOpen: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmButtonStatus?: ButtonProps['status'];
  onConfirm: ButtonProps['onClick'];
  onCancel: () => void;
};

export const Dialog = ({
  children,
  title,
  isOpen,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmButtonStatus,
  onConfirm,
  onCancel,
}: PropsWithChildren<Props>) => {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel}>
      <DialogContent
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        confirmButtonStatus={confirmButtonStatus}
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        {children}
      </DialogContent>
    </Modal>
  );
};

const DialogContent = ({
  children,
  confirmLabel,
  cancelLabel,
  confirmButtonStatus,
  onConfirm,
  onCancel,
}: PropsWithChildren<
  Pick<Props, 'confirmLabel' | 'cancelLabel' | 'confirmButtonStatus' | 'onConfirm' | 'onCancel'>
>) => {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="min-w-0">{children}</div>
      <div className="flex justify-end gap-2">
        <Button isUppercased onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button status={confirmButtonStatus} isUppercased onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
};

type OpenDialogOptions = Omit<Props, 'isOpen' | 'onConfirm' | 'onCancel'> & {
  id?: string;
  children?: ReactNode;
  closeOnBackdropClick?: boolean;
  onConfirm?: ButtonProps['onClick'];
  onCancel?(): void;
  onExitComplete?: () => void;
};

export const dialog = {
  open({
    id,
    title,
    children,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmButtonStatus,
    closeOnBackdropClick,
    onConfirm,
    onCancel,
    onExitComplete,
  }: OpenDialogOptions) {
    const closeWithCancel = (close: () => void) => {
      onCancel?.();
      close();
    };

    return modal.open({
      id,
      title,
      closeOnBackdropClick,
      onClose: onCancel,
      onExitComplete,
      children: ({ close }) => (
        <DialogContent
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          confirmButtonStatus={confirmButtonStatus}
          onCancel={() => closeWithCancel(close)}
          onConfirm={async (e: MouseEvent<HTMLButtonElement>) => {
            await onConfirm?.(e);
            close();
          }}
        >
          {children}
        </DialogContent>
      ),
    });
  },

  close(id?: string) {
    modal.close(id);
  },
};
