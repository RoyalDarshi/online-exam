// src/components/ResultBadge.tsx
import React from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type Props = {
    passed: boolean;
    isTerminated: boolean;
};

export const ResultBadge: React.FC<Props> = ({ passed, isTerminated }) => {
    if (isTerminated) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-900/40 text-rose-200 border border-rose-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                TERMINATED
            </span>
        );
    }

    if (passed) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-900/40 text-emerald-200 border border-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                PASSED
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-900/40 text-rose-200 border border-rose-700">
            <XCircle className="w-3.5 h-3.5" />
            FAILED
        </span>
    );
};
