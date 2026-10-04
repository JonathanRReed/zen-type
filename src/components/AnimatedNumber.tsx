import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../hooks/useSettings';

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
const defaultFormat = (v: number) => String(Math.round(v));

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
    value,
    format = defaultFormat,
    duration = 300,
    className = '',
    showImprovement = true,
}) => {
    const settings = useSettings();
    const [displayValue, setDisplayValue] = useState(value);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isImproving, setIsImproving] = useState(false);
    const previousValueRef = useRef(value);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        const previousValue = previousValueRef.current;

        // Check for reduced motion: the OS setting or the app's reactive setting hook
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const appReducedMotion = !!settings.reducedMotion;

        if (prefersReducedMotion || appReducedMotion) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDisplayValue(value);
            setIsUpdating(false);
            setIsImproving(false);
            previousValueRef.current = value;
            return;
        }

        // A settings change must clear motion state even if the value is unchanged.
        if (previousValue === value) return;

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
    }, [value, duration, showImprovement, settings.reducedMotion]);

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
