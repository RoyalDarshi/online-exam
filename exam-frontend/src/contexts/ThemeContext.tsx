import React, { createContext, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";

export const ThemeContext = createContext({
    theme: "dark" as ThemeMode,
    toggleTheme: () => { },
    setTheme: (t: ThemeMode) => { }
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [theme, setTheme] = useState<ThemeMode>("light");

    // Load saved preference
    useEffect(() => {
        const saved = localStorage.getItem("theme");
        if (saved === "light" || saved === "dark") {
            setTheme(saved);
            document.documentElement.classList.toggle("dark", saved === "dark");
        }
    }, []);

    const toggleTheme = () => {
        const newMode = theme === "dark" ? "light" : "dark";
        setTheme(newMode);
        localStorage.setItem("theme", newMode);
        document.documentElement.classList.toggle("dark", newMode === "dark");
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
