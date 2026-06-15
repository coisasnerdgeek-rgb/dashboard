import * as React from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  type: 'alert' | 'confirm';
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmClass?: string;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  type,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  confirmClass = 'bg-primary-600 hover:bg-primary-700',
  maxWidth = 'max-w-md',
}) => {
  const modalRef = React.useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  const isConfirmDanger = confirmText === 'Excluir' || confirmText === 'Remover' || confirmText === 'Limpar Todos' || confirmText === 'Apagar' || confirmText === 'Arquivar';
  const finalConfirmClass = confirmClass === 'bg-primary-600 hover:bg-primary-700' && isConfirmDanger
    ? 'bg-red-600 hover:bg-red-700'
    : confirmClass;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 z-[11000] backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ${maxWidth} w-full max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 opacity-100 overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b dark:border-gray-700/50">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap overflow-y-auto flex-grow">
          {children}
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex justify-end gap-3">
          {type === 'confirm' && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              {cancelText || 'Cancelar'}
            </button>
          )}
          <button
            onClick={type === 'confirm' ? handleConfirm : onClose}
            className={`px-4 py-2 text-white text-sm font-semibold rounded-md ${finalConfirmClass}`}
          >
            {type === 'confirm' ? (confirmText || 'Confirmar') : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;