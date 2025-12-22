// src/hooks/useMicMonitor.ts
import { useEffect, useRef } from "react";

type Options = {
  silenceThresholdMs?: number;
  noiseThreshold?: number;
  onSilence?: () => void;
  onNoise?: () => void;
};

export function useMicMonitor({
  silenceThresholdMs = 15000, // 15 sec silence
  noiseThreshold = 0.15, // RMS loudness
  onSilence,
  onNoise,
}: Options) {
  const silenceTimer = useRef<number>(0);
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    let stream: MediaStream;

    const init = async () => {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioCtx.current = new AudioContext();
      analyser.current = audioCtx.current.createAnalyser();
      analyser.current.fftSize = 2048;

      const source = audioCtx.current.createMediaStreamSource(stream);
      source.connect(analyser.current);

      const data = new Float32Array(analyser.current.fftSize);

      const loop = () => {
        if (!analyser.current) return;

        analyser.current.getFloatTimeDomainData(data);

        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);

        if (rms < 0.02) {
          silenceTimer.current += 250;
          if (silenceTimer.current > silenceThresholdMs) {
            onSilence?.();
            silenceTimer.current = 0;
          }
        } else {
          silenceTimer.current = 0;
        }

        if (rms > noiseThreshold) {
          onNoise?.();
        }

        setTimeout(loop, 250);
      };

      loop();
    };

    init().catch(console.error);

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx.current?.close();
    };
  }, []);
}
