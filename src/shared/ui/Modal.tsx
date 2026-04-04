import { AnimatePresence, motion } from 'motion/react';
import {
  type MouseEvent,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useId,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

export type Props = {
  isOpen: boolean;
  title: ReactNode;
  closeOnBackdropClick?: boolean;
  onClose(): void;
  onExitComplete?: () => void;
};
type ModalProps = Props;

export const Modal = ({
  isOpen,
  title,
  children,
  closeOnBackdropClick = true,
  onClose,
  onExitComplete,
}: PropsWithChildren<Props>) => {
  const id = useId();

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnBackdropClick) {
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    pushModalId(id);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopModal(id)) {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      spliceModalId(id);
    };
  }, [isOpen, onClose, id]);

  return createPortal(
    <AnimatePresence onExitComplete={onExitComplete}>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="items-center-safe justify-center-safe fixed inset-0 z-999 flex w-screen bg-black/70 backdrop-blur-lg"
          onMouseDown={handleBackdropClick}
        >
          <motion.div
            initial={{ translateY: '-20px', opacity: 0 }}
            animate={{ translateY: '0', opacity: 1 }}
            exit={{ translateY: '20px', opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex h-auto max-h-[calc(100%-40px)] min-h-0 min-w-0 max-w-full flex-col gap-3 rounded-3xl bg-black p-3 ring-2 ring-white/10"
          >
            <div className="flex shrink-0 items-center justify-between gap-1">
              <h3 className="ml-1 text-base">{title}</h3>
              <Button iconId="clear" iconSize={20} onClick={onClose} />
            </div>
            <div className="flex min-h-0 min-w-0">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// We need this to manage multiple modals and ensure only the topmost one
// responds to keyboard events like Escape
const modalIds: string[] = [];
const isTopModal = (id: string) => modalIds.length > 0 && modalIds.at(-1) === id;
const pushModalId = (id: string) => modalIds.push(id);
const spliceModalId = (id: string) => {
  const modalIndex = modalIds.lastIndexOf(id);
  if (modalIndex >= 0) modalIds.splice(modalIndex, 1);
};

type ModalRenderProp = (helpers: { close: () => void }) => ReactNode;
export type OpenModalOptions = Omit<ModalProps, 'children' | 'isOpen' | 'onClose'> & {
  id?: string;
  children: ReactNode | ModalRenderProp;
  onClose?(): void;
};

type ModalItem = OpenModalOptions & {
  id: string;
  isOpen: boolean;
};

let idCounter = 0;
let modalState: ModalItem[] = [];
const listeners = new Set<() => void>();

const emitChange = () => {
  for (const listener of listeners) listener();
};

const setModals = (updater: (current: ModalItem[]) => ModalItem[]) => {
  modalState = updater(modalState);
  emitChange();
};

const removeModal = (id: string) => {
  setModals((current) => current.filter((modalItem) => modalItem.id !== id));
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => modalState;

export const modal = {
  open(options: OpenModalOptions) {
    const id = options.id ?? `modal-${++idCounter}`;
    setModals((current) => [...current, { ...options, id, isOpen: true }]);
    return id;
  },
  close(id?: string) {
    setModals((current) => {
      const targetId = id ?? current.findLast((modalItem) => modalItem.isOpen)?.id;
      if (!targetId) return current;
      return current.map((modalItem) =>
        modalItem.id === targetId ? { ...modalItem, isOpen: false } : modalItem
      );
    });
  },
};

export const ModalHost = () => {
  const modals = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return modals.map((modalItem) => {
    const closeSelf = () => modal.close(modalItem.id);
    const childrenContent =
      typeof modalItem.children === 'function'
        ? modalItem.children({ close: closeSelf })
        : modalItem.children;

    return (
      <Modal
        key={modalItem.id}
        isOpen={modalItem.isOpen}
        title={modalItem.title}
        closeOnBackdropClick={modalItem.closeOnBackdropClick}
        onClose={() => {
          modalItem.onClose?.();
          closeSelf();
        }}
        onExitComplete={() => {
          removeModal(modalItem.id);
          modalItem.onExitComplete?.();
        }}
      >
        {childrenContent}
      </Modal>
    );
  });
};
