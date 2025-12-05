import { useEffect } from 'react';

type ProctoringOptions = {
  isActive: boolean;
  onViolation: (type: 'tab_switch' | 'fullscreen_exit' | 'devtools' | 'disconnect') => void;
};

export function useProctoring({ isActive, onViolation }: ProctoringOptions) {

  // 1. ATTEMPT KEYBOARD LOCK (Chrome/Edge Only)
  useEffect(() => {
    if (!isActive) return;

    const lockKeys = async () => {
      // @ts-ignore
      if (navigator.keyboard && navigator.keyboard.lock) {
        try {
          // Try to capture Escape, Alt, Tab, etc.
          // @ts-ignore
          await navigator.keyboard.lock(['Escape', 'Alt', 'Tab', 'Meta', 'F11', 'F5']);
          console.log("🔒 Keyboard Interface Locked");
        } catch (e) {
          console.warn("Keyboard Lock not supported/allowed");
        }
      }
    };
    lockKeys();

    return () => {
      // @ts-ignore
      if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
    };
  }, [isActive]);

  // 2. AGGRESSIVE EVENT BLOCKER
  useEffect(() => {
    if (!isActive) return;

    // Block Context Menu, Copy, Paste, Selection
    const preventDefault = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    document.addEventListener('contextmenu', preventDefault, true);
    document.addEventListener('selectstart', preventDefault, true);
    document.addEventListener('copy', preventDefault, true);
    document.addEventListener('paste', preventDefault, true);
    document.addEventListener('cut', preventDefault, true);

    // Block Keyboard Keys
    const handleKeyDown = (e: KeyboardEvent) => {
      const allowedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', ' '];

      if (allowedKeys.includes(e.key)) return;

      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('contextmenu', preventDefault, true);
      document.removeEventListener('selectstart', preventDefault, true);
      document.removeEventListener('copy', preventDefault, true);
      document.removeEventListener('paste', preventDefault, true);
      document.removeEventListener('cut', preventDefault, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isActive]);

  // 3. TAB SWITCH / FOCUS LOSS DETECTOR
  useEffect(() => {
    if (!isActive) return;

    const handleViolation = () => {
      if (document.hidden) onViolation('tab_switch');
    };

    // Detects Alt+Tab or clicking other windows
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

  // 4. FULL SCREEN MONITOR
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
    const check = setInterval(() => {
      const start = performance.now();
      debugger; // This will freeze the browser if DevTools is open
      const end = performance.now();
      if (end - start > 100) onViolation('devtools');
    }, 1000);
    return () => clearInterval(check);
  }, [isActive, onViolation]);
}

export const requestFullScreen = async () => {
  try {
    const elem = document.documentElement;
    if (elem.requestFullscreen) await elem.requestFullscreen();
    // @ts-ignore
    else if (elem.webkitRequestFullscreen) await elem.webkitRequestFullscreen();
  } catch (e) {
    console.error("Fullscreen Request Denied");
  }
};