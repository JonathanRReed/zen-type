import React, { useEffect } from 'react';

interface ModeSwitchProps {
  currentMode: 'zen' | 'quote';
  onModeChange: (mode: 'zen' | 'quote') => void;
}

const ModeSwitch: React.FC<ModeSwitchProps> = ({ currentMode, onModeChange }) => {
  // Handle Tab key for mode switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        onModeChange(currentMode === 'zen' ? 'quote' : 'zen');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMode, onModeChange]);

  return (
    <div className="inline-flex bg-surface/80 backdrop-blur-soft rounded-lg p-1 border border-iris/20">
      <button
        onClick={() => onModeChange('zen')}
        className={`
          px-6 py-2 rounded-md font-sans text-sm transition-all duration-200
          ${currentMode === 'zen' 
            ? 'bg-iris/20 text-iris border border-iris/40' 
            : 'text-muted hover:text-text hover:bg-overlay/50'
          }
        `}
        aria-pressed={currentMode === 'zen'}
      >
        Zen Mode
      </button>
      <button
        onClick={() => onModeChange('quote')}
        className={`
          px-6 py-2 rounded-md font-sans text-sm transition-all duration-200
          ${currentMode === 'quote' 
            ? 'bg-iris/20 text-iris border border-iris/40' 
            : 'text-muted hover:text-text hover:bg-overlay/50'
          }
        `}
        aria-pressed={currentMode === 'quote'}
      >
        Quote Mode
      </button>
    </div>
  );
};

export default ModeSwitch;
