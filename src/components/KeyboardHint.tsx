import React from 'react';

interface KeyboardHintProps {
    /** The key to display (e.g., "Tab", "Esc", "⌘K") */
    keyLabel: string;
    /** Optional description of what the key does */
    description?: string;
    /** Size variant */
    size?: 'sm' | 'md';
    /** Additional CSS classes */
    className?: string;
}

/**
 * KeyboardHint - Elegant keyboard shortcut display component.
 * Shows keyboard keys with a premium, tactile appearance.
 */
const KeyboardHint: React.FC<KeyboardHintProps> = ({
    keyLabel,
    description,
    size = 'sm',
    className = '',
}) => {
    const sizeClasses = size === 'sm'
        ? 'text-[0.65rem] min-w-[1.5rem] h-[1.25rem] px-1.5'
        : 'text-[0.7rem] min-w-[1.75rem] h-[1.5rem] px-2';

    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
            <kbd className={`kbd-hint ${sizeClasses}`}>
                {keyLabel}
            </kbd>
            {description && (
                <span className="text-muted text-[0.65rem] opacity-70">
                    {description}
                </span>
            )}
        </span>
    );
};

export default KeyboardHint;
