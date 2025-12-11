// src/components/AdminNavbar.tsx
import React from "react";
import { ThemeContext } from "../../contexts/ThemeContext";
import {
    LogOut,
    Sun,
    Moon,
    CalendarDays,
    Plus,
    LayoutDashboard
} from "lucide-react";

type Props = {
    onSignOut: () => void;
    onViewCalendar: () => void;
    onViewGenerator: () => void;
    currentView: string;
};

export function AdminNavbar({ onSignOut, onViewCalendar, onViewGenerator, currentView }: Props) {
    const { theme, toggleTheme } = React.useContext(ThemeContext);

    return (
        <header className="
      sticky top-0 z-30 border-b backdrop-blur-md
      bg-white/80 border-slate-200 
      dark:bg-slate-950/80 dark:border-slate-800
    ">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

                {/* Logo / Title */}
                <div className="flex items-center gap-3">
                    <div className="
            flex items-center justify-center w-8 h-8 rounded-lg 
            bg-sky-600 text-white shadow-lg shadow-sky-600/20
          ">
                        <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 hidden sm:block">
                        Admin Dashboard
                    </h1>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 sm:gap-3">

                    {/* Calendar Button */}
                    <button
                        onClick={onViewCalendar}
                        className={`
              flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border
              ${currentView === 'calendar'
                                ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-300'
                                : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                            }
            `}
                    >
                        <CalendarDays className="w-4 h-4" />
                        <span className="hidden sm:inline">Calendar</span>
                    </button>

                    {/* Create Exam Button */}
                    <button
                        onClick={onViewGenerator}
                        className="
              flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition-all shadow-sm
              bg-sky-600 hover:bg-sky-500 border border-transparent
              dark:bg-sky-600 dark:hover:bg-sky-500
            "
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Create Exam</span>
                    </button>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

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
                        onClick={onSignOut}
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