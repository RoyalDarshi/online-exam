// src/components/ViolationBadge.tsx
import React from "react";
import { ShieldAlert, CheckCircle } from "lucide-react";

type Props = {
    tabSwitches: number;
};

export const ViolationBadge: React.FC<Props> = ({ tabSwitches }) => {
    if (tabSwitches > 0) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-900/40 text-amber-200 border border-amber-700">
                <ShieldAlert className="w-3.5 h-3.5" />
                {tabSwitches} warning{tabSwitches > 1 ? "s" : ""}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-900/40 text-emerald-200 border border-emerald-700">
            <CheckCircle className="w-3.5 h-3.5" />
            Clean
        </span>
    );
};
