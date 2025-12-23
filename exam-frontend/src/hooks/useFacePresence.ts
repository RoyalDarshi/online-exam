// src/hooks/useFacePresence.ts
import { useEffect, useRef } from "react";

type Options = {
  absenceThresholdMs?: number;
  onFaceMissing?: () => void;
};

export function useFacePresence({
  absenceThresholdMs = 10000, // 10 sec
  onFaceMissing,
}: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSeen = useRef(Date.now());

  useEffect(() => {
    let stream: MediaStream;

    const init = async () => {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();
      videoRef.current = video;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      const loop = () => {
        if (!videoRef.current) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video, 0, 0);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let brightness = 0;
        for (let i = 0; i < frame.length; i += 4) {
          brightness += frame[i] + frame[i + 1] + frame[i + 2];
        }

        if (brightness > 1000000) {
          lastSeen.current = Date.now();
        }

        if (Date.now() - lastSeen.current > absenceThresholdMs) {
          onFaceMissing?.();
          lastSeen.current = Date.now();
        }

        requestAnimationFrame(loop);
      };

      loop();
    };

    init().catch(console.error);

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
}
