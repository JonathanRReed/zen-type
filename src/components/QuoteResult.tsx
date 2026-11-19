import React from 'react';
import AnimatedNumber from './AnimatedNumber';

interface QuoteResultProps {
  wpm: number;
  accuracy: number;
  seconds: number;
  /** "2 wrong keys, 1 early space", or empty for a clean run. */
  mistakes: string;
  personalBest: boolean;
  streak: number;
  showAudioHint: boolean;
  autoAdvance: boolean;
  onDismissAudioHint: () => void;
  onNext: () => void;
  onAgain: () => void;
  onSave: () => void;
  onProgress: () => void;
  onToggleAutoAdvance: () => void;
}

const formatClock = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// What a finished quote leaves behind: three figures, one sentence, and what
// to do next. It sits under the passage rather than replacing it.
const QuoteResult: React.FC<QuoteResultProps> = (props) => (
  <section className="result" aria-label="Result">
    <dl className="result-figures">
      <div>
        <dt>Words a minute</dt>
        <dd><AnimatedNumber value={props.wpm} /></dd>
      </div>
      <div>
        <dt>Accuracy</dt>
        <dd><AnimatedNumber value={props.accuracy} /><small>%</small></dd>
      </div>
      <div>
        <dt>Time</dt>
        <dd>{formatClock(props.seconds)}</dd>
      </div>
    </dl>
    <p className="result-note">
      <span>{props.mistakes ? `${props.mistakes.charAt(0).toUpperCase()}${props.mistakes.slice(1)}.` : 'No mistakes.'}</span>
      {props.personalBest && <em> Your fastest yet.</em>}
      {props.streak > 1 && <em> Day {props.streak} in a row.</em>}
    </p>
    {props.showAudioHint && (
      <p className="result-hint">
        Sound is available. Press Ctrl+M or the speaker button.{' '}
        <button type="button" className="link-button" onClick={props.onDismissAudioHint}>Got it</button>
      </p>
    )}
    <div className="result-actions">
      <button type="button" className="btn btn-primary" onClick={props.onNext}>
        Next quote <kbd aria-hidden="true">Enter</kbd>
      </button>
      <button type="button" className="btn" onClick={props.onAgain}>Type again</button>
      <button type="button" className="btn" onClick={props.onSave}>Save as image</button>
      <button type="button" className="btn" onClick={props.onProgress}>Progress</button>
      <button type="button" className="btn btn-toggle" aria-pressed={props.autoAdvance} onClick={props.onToggleAutoAdvance}>
        Auto-advance
      </button>
    </div>
  </section>
);

export default QuoteResult;
