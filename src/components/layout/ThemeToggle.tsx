import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
    collapsed?: boolean;
    variant?: "sidebar" | "dropdown";
}

export function ThemeToggle({ collapsed = false, variant = "sidebar" }: ThemeToggleProps) {
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    if (variant === "dropdown") {
        return (
            <button
                onClick={toggleTheme}
                className="w-full flex items-center px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors outline-none select-none"
            >
                <div className="mr-2 h-4 w-4 flex items-center justify-center shrink-0">
                    <AnimatePresence mode="wait" initial={false}>
                        {theme === "dark" ? (
                            <motion.div
                                key="moon"
                                initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Moon className="w-4 h-4 text-indigo-400" />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="sun"
                                initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
                                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Sun className="w-4 h-4 text-amber-500" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <span>{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
            </button>
        );
    }

    return (
        <button
            onClick={toggleTheme}
            className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group overflow-hidden",
                "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                collapsed ? "justify-center" : "w-full"
            )}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
            <div className="relative w-5 h-5 flex items-center justify-center flex-shrink-0">
                <AnimatePresence mode="wait" initial={false}>
                    {theme === "dark" ? (
                        <motion.div
                            key="moon"
                            initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                            animate={{ opacity: 1, rotate: 0, scale: 1 }}
                            exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                            transition={{ duration: 0.3, ease: "backOut" }}
                        >
                            <Moon className="w-5 h-5 text-indigo-400" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="sun"
                            initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
                            animate={{ opacity: 1, rotate: 0, scale: 1 }}
                            exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
                            transition={{ duration: 0.3, ease: "backOut" }}
                        >
                            <Sun className="w-5 h-5 text-amber-500" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {!collapsed && (
                <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="font-medium text-sm whitespace-nowrap"
                >
                    {theme === "dark" ? "Dark Mode" : "Light Mode"}
                </motion.span>
            )}

            {/* Glossy effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
        </button>
    );
}
