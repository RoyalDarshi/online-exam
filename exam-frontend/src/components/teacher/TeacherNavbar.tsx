// src/components/teacher/TeacherNavbar.tsx
import React, { useContext } from "react";
import { ThemeContext } from "../../contexts/ThemeContext";
import {
    LogOut,
    Sun,
    Moon,
    BookOpen,
    GraduationCap
} from "lucide-react";

type Props = {
    user: any;
    onLogout: () => void;
};

export function TeacherNavbar({ user, onLogout }: Props) {
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <header className="
      sticky top-0 z-30 border-b backdrop-blur-md
      bg-white/80 border-slate-200 
      dark:bg-slate-950/80 dark:border-slate-800
    ">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

                {/* Brand */}
                <div className="flex items-center gap-3">
                    <div className="
            flex items-center justify-center w-8 h-8 rounded-lg 
            bg-sky-600 text-white shadow-lg shadow-sky-600/20
          ">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight hidden sm:block">
                            Teacher Portal
                        </h1>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 sm:gap-3">

                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center">
                            <GraduationCap className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                            {user?.full_name || "Teacher"}
                        </span>
                    </div>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block" />

                    <button
                        onClick={toggleTheme}
                        className="
              p-2 rounded-lg transition-colors
              text-slate-500 hover:bg-slate-100 hover:text-sky-600
              dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-sky-400
            "
                        title="Toggle Theme"
                    >
                        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={onLogout}
                        className="
              p-2 rounded-lg transition-colors
              text-slate-500 hover:bg-rose-50 hover:text-rose-600
              dark:text-slate-400 dark:hover:bg-rose-900/20 dark:hover:text-rose-400
            "
                        title="Sign Out"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </header>
    );
}