import '../styles/ComingSoon.css';

interface ComingSoonProps {
  title: string;
  description?: string;
}

const ComingSoon = ({ title, description }: ComingSoonProps) => {
  return (
    <div className="coming-soon-container">
      <div className="coming-soon-content">
        <h1>🚧 {title}</h1>
        <p className="coming-soon-text">PRÓXIMAMENTE</p>
        {description && <p className="coming-soon-description">{description}</p>}
      </div>
    </div>
  );
};

export default ComingSoon;

