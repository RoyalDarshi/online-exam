// src/components/student/StudentNavbar.tsx
import React, { useContext } from "react";
import { ThemeContext } from "../../contexts/ThemeContext";
import {
    LogOut,
    Sun,
    Moon,
    History,
    Layout,
    User
} from "lucide-react";

type Props = {
    user: {
        full_name: string;
        role: string;
    };
    onLogout: () => void;
    onHistory: () => void;
    onDashboard?: () => void; // Added to allow clicking logo to go home
    currentView?: string;     // Added to highlight active tab
};

export default function StudentNavbar({
    user,
    onLogout,
    onHistory,
    onDashboard,
    currentView
}: Props) {
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <header className="
      sticky top-0 z-30 border-b backdrop-blur-md
      bg-white/80 border-slate-200 
      dark:bg-slate-950/80 dark:border-slate-800
    ">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

                {/* LEFT — Logo / Brand */}
                <div
                    onClick={onDashboard}
                    className={`flex items-center gap-3 group ${onDashboard ? 'cursor-pointer' : ''}`}
                >
                    <div className="
            flex items-center justify-center w-8 h-8 rounded-lg transition-transform group-hover:scale-105
            bg-sky-600 text-white shadow-lg shadow-sky-600/20
          ">
                        <Layout className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight hidden sm:block">
                            Assessment Dashboard
                        </h1>
                    </div>
                </div>

                {/* RIGHT — Actions */}
                <div className="flex items-center gap-2 sm:gap-3">

                    {/* User Badge (Desktop) */}
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                            {user?.full_name || "Student"}
                        </span>
                    </div>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block" />

                    {/* History Button */}
                    <button
                        onClick={onHistory}
                        className={`
              flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border
              ${currentView === 'history'
                                ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-300'
                                : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                            }
            `}
                    >
                        <History className="w-4 h-4" />
                        <span className="hidden sm:inline">History</span>
                    </button>

                    {/* Theme Toggle */}
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

                    {/* Sign Out */}
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