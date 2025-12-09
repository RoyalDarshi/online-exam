import React, { useMemo, useState } from 'react';
import { Exam } from '../lib/supabase';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

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
    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const calendar = useMemo<CalendarDay[]>(() => {
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
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <CalendarDays className="w-6 h-6 text-blue-600" />
                                Exam Calendar
                            </h1>
                            <p className="text-sm text-gray-500">View all scheduled exams by date.</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Month controls */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={goPrev}
                            className="p-2 rounded-full hover:bg-gray-200 text-gray-600"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="px-4 py-2 rounded-full bg-white shadow-sm border text-gray-900 font-semibold">
                            {monthLabel}
                        </div>
                        <button
                            onClick={goNext}
                            className="p-2 rounded-full hover:bg-gray-200 text-gray-600"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Calendar grid */}
                <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
                    {/* Weekday header */}
                    <div className="grid grid-cols-7 border-b bg-gray-50">
                        {weekdayLabels.map(label => (
                            <div
                                key={label}
                                className="py-2 text-xs font-semibold text-gray-500 text-center uppercase tracking-wide"
                            >
                                {label}
                            </div>
                        ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7">
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
                                    className={`h-32 border-b border-r last:border-r-0 flex flex-col p-1 text-xs
                    ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50/70 text-gray-400'}`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span
                                            className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold
                        ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
                                        >
                                            {day.date.getDate()}
                                        </span>
                                    </div>

                                    <div className="space-y-1 overflow-y-auto scrollbar-thin">
                                        {day.exams.map(ex => (
                                            <div
                                                key={ex.id}
                                                className="px-1 py-1 rounded-md bg-blue-50 border border-blue-100 text-[11px] text-blue-900 flex items-center gap-1"
                                            >
                                                <Clock className="w-3 h-3" />
                                                <span className="truncate">
                                                    {new Date(ex.start_time!).toLocaleTimeString('en-IN', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}{' '}
                                                    – {ex.title}
                                                </span>
                                            </div>
                                        ))}

                                        {day.exams.length === 0 && (
                                            <span className="text-[10px] text-gray-300 italic">No exams</span>
                                        )}
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
