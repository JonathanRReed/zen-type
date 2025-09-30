import React from 'react';
import DraftManager from './draft/DraftManager';

interface SimpleDraftsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SimpleDrafts: React.FC<SimpleDraftsProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  // Use enhanced Draft Manager with all features
  return <DraftManager isOpen={isOpen} onClose={onClose} />;
};

export default SimpleDrafts;
