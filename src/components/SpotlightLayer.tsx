import React, { useEffect, useRef } from 'react';

/**
 * SpotlightLayer - Creates a subtle radial gradient that follows the cursor.
 * Adds depth and interactivity to the page, inspired by Linear/Raycast.
 */
const SpotlightLayer: React.FC = () => {
    const layerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const isActiveRef = useRef(false);

    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;

        // Check reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) return;

        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let currentX = mouseX;
        let currentY = mouseY;

        const lerp = (start: number, end: number, factor: number) => {
            return start + (end - start) * factor;
        };

        const root = document.documentElement;
        const updatePosition = () => {
            // Smooth interpolation for fluid movement
            currentX = lerp(currentX, mouseX, 0.08);
            currentY = lerp(currentY, mouseY, 0.08);

            const xPx = `${currentX}px`;
            const yPx = `${currentY}px`;
            layer.style.setProperty('--cursor-x', xPx);
            layer.style.setProperty('--cursor-y', yPx);
            // Expose to the document root so other effects (starfield parallax,
            // theme FX layers) can read the same cursor coordinates.
            root.style.setProperty('--cursor-x', xPx);
            root.style.setProperty('--cursor-y', yPx);
            // Also expose a normalized 0-1 coordinate for subtle parallax math
            root.style.setProperty('--cursor-nx', `${currentX / window.innerWidth}`);
            root.style.setProperty('--cursor-ny', `${currentY / window.innerHeight}`);

            rafRef.current = requestAnimationFrame(updatePosition);
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            if (!isActiveRef.current) {
                isActiveRef.current = true;
                layer.classList.add('active');
                updatePosition();
            }
        };

        const handleMouseLeave = () => {
            // Don't deactivate entirely - just stop updating
            // This keeps the spotlight visible at last position
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);

    return (
        <div
            ref={layerRef}
            className="spotlight-layer"
            aria-hidden="true"
        />
    );
};

export default SpotlightLayer;
