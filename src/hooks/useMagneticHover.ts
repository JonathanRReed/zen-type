import { useCallback, useRef } from 'react';

/**
 * useMagneticHover - Creates a magnetic hover effect where elements
 * subtly move toward the cursor position when hovered.
 * 
 * Inspired by Raycast and Linear button hover effects.
 * 
 * @param strength - How strongly the element is attracted (1-10, default 4)
 * @returns Event handlers to spread on the element
 */
export function useMagneticHover(strength: number = 4) {
    const elementRef = useRef<HTMLElement | null>(null);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
        const element = e.currentTarget;
        elementRef.current = element;

        // Check reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Calculate distance from center (normalized to -1 to 1)
        const deltaX = (e.clientX - centerX) / (rect.width / 2);
        const deltaY = (e.clientY - centerY) / (rect.height / 2);

        // Apply magnetic effect (clamped)
        const maxOffset = strength;
        const offsetX = Math.max(-maxOffset, Math.min(maxOffset, deltaX * strength));
        const offsetY = Math.max(-maxOffset, Math.min(maxOffset, deltaY * strength));

        element.style.setProperty('--mx', String(offsetX / strength));
        element.style.setProperty('--my', String(offsetY / strength));
    }, [strength]);

    const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
        const element = e.currentTarget;
        element.style.setProperty('--mx', '0');
        element.style.setProperty('--my', '0');
    }, []);

    return {
        onMouseMove: handleMouseMove,
        onMouseLeave: handleMouseLeave,
        className: 'magnetic-btn',
    };
}

export default useMagneticHover;
