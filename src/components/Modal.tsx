import { type ReactNode } from 'react';
import '../styles/Modal.css';

interface ModalProps {
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const Modal = ({ onClose, title, children }: ModalProps) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;

