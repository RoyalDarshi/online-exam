// src/components/ResultsPagination.tsx
import React from "react";

type Props = {
    page: number;
    totalPages: number;
    onChange: (page: number) => void;
};

export const ResultsPagination: React.FC<Props> = ({
    page,
    totalPages,
    onChange,
}) => {
    return (
        <div className="flex justify-center items-center gap-3 text-xs sm:text-sm text-slate-300">
            <button
                disabled={page === 1}
                onClick={() => onChange(page - 1)}
                className={`px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 transition ${page === 1 ? "opacity-40 cursor-not-allowed" : ""
                    }`}
            >
                Previous
            </button>

            <span className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700">
                Page <span className="font-semibold">{page}</span> / {totalPages}
            </span>

            <button
                disabled={page === totalPages}
                onClick={() => onChange(page + 1)}
                className={`px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 transition ${page === totalPages ? "opacity-40 cursor-not-allowed" : ""
                    }`}
            >
                Next
            </button>
        </div>
    );
};
