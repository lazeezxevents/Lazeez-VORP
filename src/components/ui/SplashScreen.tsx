import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import lazeezIcon from "@/assets/Lazeez Events  - Logo _Icon .png";

interface SplashScreenProps {
    onComplete?: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            if (onComplete) {
                setTimeout(onComplete, 1000); // Extended exit duration
            }
        }, 3500); // Slightly longer for premium feel

        return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{
                        opacity: 0,
                        transition: { duration: 0.5, ease: "easeInOut" }
                    }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-white overflow-hidden"
                >
                    {/* Elite Cinematic Ambiance */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {/* Simplified Background */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#f8fafc_0%,#ffffff_100%)]" />
                        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />



                        {/* Premium Architecture Grid */}
                        <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,#000_70%,transparent_100%)]" />
                    </div>

                    {/* Main Cinematic Content */}
                    <div className="relative flex flex-col items-center">

                        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12 mb-20 animate-in fade-in duration-1000">
                            {/* Giant Floating Identity */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{
                                    duration: 1.2,
                                    ease: [0.16, 1, 0.3, 1]
                                }}
                                className="relative"
                            >
                                <img
                                    src={lazeezIcon}
                                    alt="Lazeez Logo"
                                    className="w-32 h-32 md:w-52 md:h-52 object-contain relative z-10 drop-shadow-[0_20px_50px_rgba(0,0,0,0.12)]"
                                />
                            </motion.div>

                            {/* Vertical Light Beam */}
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 180, opacity: 1 }}
                                transition={{ delay: 0.5, duration: 1.2, ease: "circOut" }}
                                className="hidden md:block w-[1px] bg-gradient-to-b from-transparent via-primary/40 to-transparent"
                            />

                            {/* VORP Signature Branding */}
                            <div className="flex flex-col text-center md:text-left">
                                <motion.div
                                    initial={{ x: 40, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.7, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                                >
                                    <h1 className="text-4xl md:text-6xl font-bold tracking-[-0.04em] text-primary font-poppins leading-[0.85] mb-2">
                                        VORP
                                    </h1>

                                    <div className="space-y-1">
                                        <motion.p
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 1, duration: 0.8 }}
                                            className="text-lg md:text-xl font-medium text-foreground/80 font-poppins"
                                        >
                                            Vendor Operations & Resource Platform
                                        </motion.p>
                                    </div>
                                </motion.div>
                            </div>
                        </div>

                        {/* Center Progress Bar */}
                        <div className="w-80 h-[2px] bg-primary/10 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ x: "-100%" }}
                                animate={{ x: "0%" }}
                                transition={{
                                    duration: 3,
                                    ease: [0.33, 1, 0.68, 1]
                                }}
                                className="w-full h-full bg-primary/60"
                            />
                        </div>
                    </div>

                    {/* Simple Lighting Accents */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                        <div className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                    </div>
                </motion.div>
            )
            }
        </AnimatePresence >
    );
};

export default SplashScreen;
