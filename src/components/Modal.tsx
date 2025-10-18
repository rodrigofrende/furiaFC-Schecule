import { type ReactNode, useEffect } from 'react';
import '../styles/Modal.css';

interface ModalProps {
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSubmit?: () => void;
}

const Modal = ({ onClose, title, children, onSubmit }: ModalProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && onSubmit) {
        // Verificar si el foco está en un textarea
        const target = e.target as HTMLElement;
        const isTextarea = target.tagName === 'TEXTAREA';
        
        // Si es Ctrl/Cmd+Enter, siempre enviar
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onSubmit();
        }
        // Si es Enter solo y NO estamos en un textarea, enviar
        else if (!isTextarea && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, onSubmit]);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {onSubmit && (
          <div className="modal-shortcuts">
            <span className="shortcut-hint">
              <kbd>Esc</kbd> para cerrar • <kbd>Enter</kbd> para guardar
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;

