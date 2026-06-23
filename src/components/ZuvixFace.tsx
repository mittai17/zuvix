import { useState } from 'react';
import './ZuvixFace.css';
import { MOUTH_PATHS, CHEEK_COLORS } from './ZuvixFaceTraits';

export type ZuvixFaceState = 'idle' | 'engaged' | 'hidden' | 'error' | 'success';

interface ZuvixFaceProps {
  state: ZuvixFaceState;
  globalRoam?: boolean;
}

export default function ZuvixFace({ state, globalRoam = false }: ZuvixFaceProps) {
  const [isHovered, setIsHovered] = useState(false);

  const currentMouth = MOUTH_PATHS[state] || MOUTH_PATHS.idle;
  // If hovered/touched, make cheeks glow brighter. Otherwise use default state glow.
  const currentCheekColor = isHovered ? CHEEK_COLORS.engaged : (CHEEK_COLORS[state] || CHEEK_COLORS.idle);

  const wrapperClass = globalRoam ? 'zuvix-global-roamer zuvix-face-wrapper' : 'zuvix-face-wrapper';

  return (
    <div 
      className={wrapperClass}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
    >

      <div className={`zuvix-face-container ${state}`}>
        <div className="face-elements">
          <div className="cheeks">
            <div className="cheek" style={{ background: currentCheekColor }}></div>
            <div className="cheek" style={{ background: currentCheekColor }}></div>
          </div>
          
          <div className="eyes-container">
            <div className="eye"></div>
            <div className="eye"></div>
          </div>

          <div className="mouth-container">
            <svg viewBox="0 0 40 30" width="40" height="30">
              <path className="mouth-path" d={currentMouth} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
