import { useEffect } from "react";

export function useExamGuardLockdown() {
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("http://localhost:12345/scan-and-kill", {
        method: "POST",
      }).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, []);
}
