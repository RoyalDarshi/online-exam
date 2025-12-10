import React, { useContext, useState } from "react";
import { ThemeContext } from "../../contexts/ThemeContext";
import {
    Sun,
    Moon,
    LogOut,
    History,
    FileText,
    ChevronDown,
    User,
} from "lucide-react";

interface Props {
    user: {
        full_name: string;
        role: string;
    };
    onLogout: () => void;
    onHistory: () => void;
}

export default function StudentNavbar({ user, onLogout, onHistory }: Props) {
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [open, setOpen] = useState(false);

    return (
        <header
            className="
        w-full sticky top-0 z-40 backdrop-blur-md border-b
        bg-white/90 border-slate-200
        dark:bg-slate-900/90 dark:border-slate-800
      "
        >
            <div className="max-w-7xl mx-auto px-5 py-4 flex justify-between items-center">

                {/* LEFT — Title */}
                <h1 className="text-xl font-bold flex items-center gap-2
           text-slate-800 dark:text-sky-300"
                >
                    <FileText className="w-5 h-5" />
                    Assessment Dashboard
                </h1>

                {/* RIGHT — Buttons */}
                <div className="flex items-center gap-4">

                    {/* USER NAME */}
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                        {user.full_name} ({user.role})
                    </span>

                    {/* HISTORY BUTTON */}
                    <button
                        onClick={onHistory}
                        className="
              px-3 py-2 rounded-lg border text-sm flex items-center gap-2
              bg-white text-slate-700 border-slate-300 hover:bg-slate-100
              dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700
            "
                    >
                        <History className="w-4 h-4 text-sky-500 dark:text-sky-300" />
                        History
                    </button>

                    {/* THEME SWITCH */}
                    <button
                        onClick={toggleTheme}
                        className="
              px-3 py-2 rounded-lg border text-sm flex items-center gap-2
              bg-white text-slate-700 border-slate-300 hover:bg-slate-100
              dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700
            "
                    >
                        {theme === "dark" ? (
                            <>
                                <Sun className="w-4 h-4 text-yellow-400" />
                                Light
                            </>
                        ) : (
                            <>
                                <Moon className="w-4 h-4 text-slate-900" />
                                Dark
                            </>
                        )}
                    </button>

                    {/* PROFILE DROPDOWN (optional) */}

                    <button
                        onClick={onLogout}
                        className="
                    px-3 py-2 rounded-lg border text-sm flex items-center gap-2
              bg-white text-slate-700 border-slate-300 hover:bg-slate-100
              dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700
                  "
                    >
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>

                </div>
            </div>
        </header >
    );
}
