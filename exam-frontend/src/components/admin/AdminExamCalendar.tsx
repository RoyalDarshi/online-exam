// src/components/AdminExamCalendar.tsx
import React from 'react';
import { Exam } from '../../lib/supabase';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Clock,
    Calendar as CalendarIcon
} from 'lucide-react';

type Props = {
    exams: Exam[];
    onBack: () => void;
};

type CalendarDay = {
    date: Date;
    isCurrentMonth: boolean;
    exams: Exam[];
};

export function AdminExamCalendar({ exams, onBack }: Props) {
    const [currentMonth, setCurrentMonth] = React.useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const calendar = React.useMemo<CalendarDay[]>(() => {
        const days: CalendarDay[] = [];

        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        // Monday = 1; Sunday = 0
        const startOffset = (firstDayOfMonth.getDay() + 6) % 7; // make Monday start
        const totalDays = lastDayOfMonth.getDate();

        const gridStart = new Date(year, month, 1 - startOffset);
        const gridEnd = new Date(year, month, totalDays + (42 - (startOffset + totalDays)));

        // Normalize helper
        const sameDay = (d1: Date, d2: Date) =>
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();

        // Build list
        for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
            const date = new Date(d);

            const dayExams = exams.filter(ex => {
                if (!ex.start_time) return false;
                const st = new Date(ex.start_time);
                return sameDay(st, date);
            });

            days.push({
                date,
                isCurrentMonth: date.getMonth() === month,
                exams: dayExams
            });
        }

        return days;
    }, [currentMonth, exams]);

    const monthLabel = currentMonth.toLocaleString('en-IN', {
        month: 'long',
        year: 'numeric'
    });

    const goPrev = () => {
        setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    };

    const goNext = () => {
        setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    };

    const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Header / Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="
                                p-2 rounded-full border transition-colors
                                bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100
                                dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800
                            "
                            title="Back to List"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <button
                                onClick={goPrev}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="min-w-[140px] text-center font-semibold text-slate-900 dark:text-slate-100 select-none">
                                {monthLabel}
                            </span>
                            <button
                                onClick={goNext}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Legend / Stats */}
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <CalendarIcon className="w-4 h-4" />
                        <span>Showing exams for {monthLabel}</span>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="
                    rounded-2xl border shadow-sm overflow-hidden
                    bg-white border-slate-200 shadow-slate-200/50
                    dark:bg-slate-900 dark:border-slate-800 dark:shadow-slate-900/50
                ">
                    {/* Weekday Header */}
                    <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                        {weekdayLabels.map(label => (
                            <div
                                key={label}
                                className="py-3 text-xs font-bold text-slate-400 dark:text-slate-500 text-center uppercase tracking-wider"
                            >
                                {label}
                            </div>
                        ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 bg-slate-200 dark:bg-slate-800 gap-px">
                        {calendar.map((day, idx) => {
                            const isToday = (() => {
                                const t = new Date();
                                return (
                                    t.getFullYear() === day.date.getFullYear() &&
                                    t.getMonth() === day.date.getMonth() &&
                                    t.getDate() === day.date.getDate()
                                );
                            })();

                            return (
                                <div
                                    key={idx}
                                    className={`
                                        min-h-[140px] p-2 flex flex-col relative transition-colors
                                        ${day.isCurrentMonth
                                            ? 'bg-white dark:bg-slate-900'
                                            : 'bg-slate-50/50 dark:bg-slate-950/40 text-slate-300 dark:text-slate-700'
                                        }
                                    `}
                                >
                                    {/* Date Number */}
                                    <div className="flex items-center justify-between mb-2">
                                        <span
                                            className={`
                                                w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold
                                                ${isToday
                                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                                                    : 'text-slate-700 dark:text-slate-400'
                                                }
                                            `}
                                        >
                                            {day.date.getDate()}
                                        </span>
                                    </div>

                                    {/* Exams List */}
                                    <div className="space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 pr-1">
                                        {day.exams.map(ex => (
                                            <div
                                                key={ex.id}
                                                className="
                                                    px-2 py-1.5 rounded-md text-[11px] font-medium border flex flex-col gap-0.5 shadow-sm
                                                    bg-sky-50 border-sky-100 text-sky-900
                                                    dark:bg-sky-900/20 dark:border-sky-800/50 dark:text-sky-200
                                                    hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors cursor-default
                                                "
                                                title={ex.title}
                                            >
                                                <div className="flex items-center gap-1 opacity-80">
                                                    <Clock className="w-3 h-3" />
                                                    <span>
                                                        {new Date(ex.start_time!).toLocaleTimeString('en-IN', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                <span className="truncate leading-tight">
                                                    {ex.title}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
}