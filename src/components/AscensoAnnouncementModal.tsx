import { useEffect, useState } from 'react';
import Modal from './Modal';
import '../styles/AscensoAnnouncementModal.css';

const ASCENSO_MODAL_STORAGE_KEY = 'furiaAscensoAnnouncementDismissed-v1';

const AscensoAnnouncementModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem(ASCENSO_MODAL_STORAGE_KEY) === 'true';

    if (!wasDismissed) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(ASCENSO_MODAL_STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal onClose={handleClose} title="💙">
      <div className="ascenso-modal-content">
        <div className="ascenso-chat-bubble">
          <p>
            Felicidades por el ascenso FURIOS
            <span className="ascenso-a-badge" aria-label="A">A</span>
            S!!
          </p>
          <p>AHORA QUEREMOS LA COPA !! 🏆 🤍 💙</p>
        </div>

        <button className="ascenso-confirm-button" onClick={handleClose}>
          Vamos Furia
        </button>
      </div>
    </Modal>
  );
};

export default AscensoAnnouncementModal;
