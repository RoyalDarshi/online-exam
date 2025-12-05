import { useEffect } from 'react';

type ProctoringOptions = {
    isActive: boolean;
    onViolation: (type: 'tab_switch' | 'fullscreen_exit' | 'devtools' | 'disconnect') => void;
};

export function useProctoring({ isActive, onViolation }: ProctoringOptions) {

    // 1. BLOCK KEYBOARD (Aggressive)
    useEffect(() => {
        if (!isActive) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Whitelist: Allow only Arrow Keys for scrolling/navigation
            const allowedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

            if (allowedKeys.includes(e.key)) {
                return; // Allow arrow keys
            }

            // BLOCK EVERYTHING ELSE
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.returnValue = false; // Legacy browser support

            return false;
        };

        // 'true' = Capture Phase (Intersects event before it reaches anything else)
        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('keyup', handleKeyDown, true);
        window.addEventListener('keypress', handleKeyDown, true);

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('keyup', handleKeyDown, true);
            window.removeEventListener('keypress', handleKeyDown, true);
        };
    }, [isActive]);

    // 2. BLOCK RIGHT CLICK & COPY/PASTE
    useEffect(() => {
        if (!isActive) return;

        const preventDefault = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        };

        document.addEventListener('contextmenu', preventDefault, true);
        document.addEventListener('copy', preventDefault, true);
        document.addEventListener('cut', preventDefault, true);
        document.addEventListener('paste', preventDefault, true);
        document.addEventListener('selectstart', preventDefault, true); // Disable text selection
        document.addEventListener('dragstart', preventDefault, true);   // Disable dragging images

        return () => {
            document.removeEventListener('contextmenu', preventDefault, true);
            document.removeEventListener('copy', preventDefault, true);
            document.removeEventListener('cut', preventDefault, true);
            document.removeEventListener('paste', preventDefault, true);
            document.removeEventListener('selectstart', preventDefault, true);
            document.removeEventListener('dragstart', preventDefault, true);
        };
    }, [isActive]);

    // 3. DETECT TAB SWITCHING (The Backup Plan)
    // Since we cannot block "Ctrl+T" or "Alt+Tab", we punish the USER if they do it.
    useEffect(() => {
        if (!isActive) return;

        const handleViolation = () => {
            if (document.hidden) onViolation('tab_switch');
        };

        // Aggressive Blur detection (detects when user clicks outside the browser or uses Alt+Tab)
        const handleBlur = () => {
            onViolation('tab_switch');
        };

        document.addEventListener('visibilitychange', handleViolation);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleViolation);
            window.removeEventListener('blur', handleBlur);
        };
    }, [isActive, onViolation]);

    // 4. FULL SCREEN ENFORCEMENT
    useEffect(() => {
        if (!isActive) return;

        const handleFullScreenChange = () => {
            if (!document.fullscreenElement) {
                onViolation('fullscreen_exit');
            }
        };

        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
    }, [isActive, onViolation]);

    // 5. DEVTOOLS TRAP
    useEffect(() => {
        if (!isActive) return;

        const devToolsCheck = setInterval(() => {
            const start = performance.now();
            debugger; // Freezes the browser if DevTools is open
            const end = performance.now();

            if (end - start > 100) {
                onViolation('devtools');
            }
        }, 1000);

        return () => clearInterval(devToolsCheck);
    }, [isActive, onViolation]);

    // 6. NETWORK DISCONNECT
    useEffect(() => {
        if (!isActive) return;
        const handleOffline = () => onViolation('disconnect');
        window.addEventListener('offline', handleOffline);
        return () => window.removeEventListener('offline', handleOffline);
    }, [isActive, onViolation]);
}

export const requestFullScreen = async () => {
    try {
        const elem = document.documentElement;
        if (elem.requestFullscreen) await elem.requestFullscreen();
    } catch (e) {
        console.error("Fullscreen denied", e);
    }
};