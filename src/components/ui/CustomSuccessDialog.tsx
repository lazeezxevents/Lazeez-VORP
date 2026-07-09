import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

interface CustomSuccessDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
}

export function CustomSuccessDialog({
    open,
    onOpenChange,
    title,
    description,
}: CustomSuccessDialogProps) {
    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => onOpenChange(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Dialog Container */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-primary/20 bg-background/95 p-8 text-center shadow-2xl backdrop-blur-xl"
                    >
                        {/* Ambient Background Glow */}
                        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-primary/20 blur-[80px]" />
                        <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-primary/20 blur-[80px]" />

                        <div className="relative flex flex-col items-center gap-4">
                            {/* Animated Tick Icon */}
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{
                                    delay: 0.2,
                                    type: "spring",
                                    stiffness: 250,
                                    damping: 15,
                                }}
                                className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-primary/80 shadow-lg shadow-primary/30"
                            >
                                <motion.div
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 1 }}
                                    transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
                                >
                                    <Check className="h-10 w-10 text-primary-foreground" strokeWidth={3} />
                                </motion.div>
                            </motion.div>

                            <div className="space-y-2">
                                <motion.h2
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="font-poppins text-2xl font-bold tracking-tight text-foreground"
                                >
                                    {title}
                                </motion.h2>
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-sm font-medium text-muted-foreground"
                                >
                                    {description}
                                </motion.p>
                            </div>

                            <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                onClick={() => onOpenChange(false)}
                                className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-95"
                            >
                                Continue
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
