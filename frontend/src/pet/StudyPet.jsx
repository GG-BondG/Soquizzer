import { usePet } from './PetContext.jsx';
import './StudyPet.css';

export default function StudyPet() {
  const { mood, message } = usePet();

  return (
    <div className={`pet ${mood}`} aria-live="polite" aria-label="Study pet">
      <div className="pet-bubble">{message}</div>
      <div className="pet-body">
        <div className="pet-face">
          <span className="pet-eye left" />
          <span className="pet-eye right" />
          <span className="pet-mouth" />
        </div>
      </div>
    </div>
  );
}
