import React, { useEffect, useRef } from 'react';

/**
 * SpotlightLayer - Creates a subtle radial gradient that follows the cursor.
 * Adds depth and interactivity to the page, inspired by Linear/Raycast.
 * Persists across Astro view transitions.
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

        const updatePosition = () => {
            // Smooth interpolation for fluid movement
            currentX = lerp(currentX, mouseX, 0.08);
            currentY = lerp(currentY, mouseY, 0.08);

            layer.style.setProperty('--cursor-x', `${currentX}px`);
            layer.style.setProperty('--cursor-y', `${currentY}px`);

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

        // Start animation loop immediately
        updatePosition();

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);

        // Handle Astro view transitions - reinitialize on page load
        const handlePageLoad = () => {
            if (isActiveRef.current && rafRef.current === null) {
                updatePosition();
            }
        };
        document.addEventListener('astro:page-load', handlePageLoad);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            document.removeEventListener('astro:page-load', handlePageLoad);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);

    return (
        <div
            ref={layerRef}
            className="spotlight-layer active"
            aria-hidden="true"
            data-astro-transition-persist="spotlight"
        />
    );
};

export default SpotlightLayer;

