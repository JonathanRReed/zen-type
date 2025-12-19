import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
    value: number;
    /** Format function for display (e.g., adding % suffix) */
    format?: (value: number) => string;
    /** Duration of animation in ms */
    duration?: number;
    /** CSS class name */
    className?: string;
    /** Show improvement glow when value increases */
    showImprovement?: boolean;
}

/**
 * AnimatedNumber - Smoothly animates between number values.
 * Features a subtle pop animation and optional improvement glow.
 */
const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
    value,
    format = (v) => String(Math.round(v)),
    duration = 300,
    className = '',
    showImprovement = true,
}) => {
    const [displayValue, setDisplayValue] = useState(value);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isImproving, setIsImproving] = useState(false);
    const previousValueRef = useRef(value);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        const previousValue = previousValueRef.current;

        // Skip animation if value hasn't changed
        if (previousValue === value) return;

        // Check for reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (prefersReducedMotion) {
            setDisplayValue(value);
            previousValueRef.current = value;
            return;
        }

        // Determine if this is an improvement
        const improving = showImprovement && value > previousValue;
        setIsImproving(improving);
        setIsUpdating(true);

        const startTime = performance.now();
        const startValue = previousValue;
        const endValue = value;

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic for smooth deceleration
            const eased = 1 - Math.pow(1 - progress, 3);

            const current = startValue + (endValue - startValue) * eased;
            setDisplayValue(current);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                setDisplayValue(endValue);
                previousValueRef.current = endValue;

                // Remove updating class after animation
                setTimeout(() => {
                    setIsUpdating(false);
                    setIsImproving(false);
                }, 150);
            }
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [value, duration, showImprovement]);

    const classes = [
        'animated-number',
        className,
        isUpdating ? 'updating' : '',
        isImproving ? 'improving' : '',
    ].filter(Boolean).join(' ');

    return (
        <span className={classes}>
            {format(displayValue)}
        </span>
    );
};

export default AnimatedNumber;
