// src/hooks/useScreenCaptureGuard.ts
import { useEffect } from "react";
import { setScreenCaptureActive } from "../utils/screenCaptureState";

type Options = {
  onDetected: () => void;
};

export function useScreenCaptureGuard({ onDetected }: Options) {
  useEffect(() => {
    if (!navigator.mediaDevices?.getDisplayMedia) return;

    const original = navigator.mediaDevices.getDisplayMedia.bind(
      navigator.mediaDevices
    );

    navigator.mediaDevices.getDisplayMedia = async (...args: any[]) => {
      // 🚨 REAL screen-sharing attempt
      onDetected();

      const stream = await original(...args);
      setScreenCaptureActive(true);

      // Detect stop sharing
      stream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          setScreenCaptureActive(false);
        });
      });

      return stream;
    };

    return () => {
      navigator.mediaDevices.getDisplayMedia = original;
    };
  }, [onDetected]);
}
