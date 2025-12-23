// src/hooks/useExamGuard.ts
import { useEffect, useState } from "react";

export function useExamGuard(poll: boolean = false) {
    const [active, setActive] = useState<boolean>(false);

    const check = async () => {
        try {
            const res = await fetch("http://localhost:12345/check", {
                method: "GET",
            });
            if (!res.ok) throw new Error("ExamGuard not responding");
            const data = await res.json();
            setActive(!!data.active);
            // setActive(true); // Temporarily always active
        } catch {
            setActive(false);
        }
    };

    useEffect(() => {
        // Initial check
        check();

        if (!poll) return;

        const interval = setInterval(check, 5000); // 5 seconds
        return () => clearInterval(interval);
    }, [poll]);

    return active;
}
