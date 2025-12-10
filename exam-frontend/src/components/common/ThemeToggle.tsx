import { useContext } from "react";
import { ThemeContext } from "../../contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

const ThemeToggle = () => {
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <button
            onClick={toggleTheme}
            className="
        flex items-center gap-2 px-3 py-1.5
        rounded-lg border transition font-semibold text-xs
        bg-white text-slate-700 border-slate-300 hover:bg-slate-100
        dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700
      "
        >
            {theme === "dark" ? (
                <Sun className="w-4 h-4 text-yellow-500" />
            ) : (
                <Moon className="w-4 h-4 text-slate-900" />
            )}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
    );
};

export default ThemeToggle;
