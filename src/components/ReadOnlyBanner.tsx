import { useAuth } from '../context/AuthContext';
import '../styles/ReadOnlyBanner.css';

const ReadOnlyBanner = () => {
  const { isReadOnly } = useAuth();

  if (!isReadOnly) return null;

  return (
    <div className="readonly-banner">
      <div className="readonly-banner-content">
        <span className="readonly-icon">👁️</span>
        <div className="readonly-text">
          <strong>Modo Solo Lectura</strong>
          <span className="readonly-description readonly-description-desktop">
            Estás usando una cuenta de demostración. Podés explorar toda la plataforma pero no realizar cambios.
          </span>
          <span className="readonly-description readonly-description-mobile">
            Cuenta demo - No podés realizar cambios
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReadOnlyBanner;

