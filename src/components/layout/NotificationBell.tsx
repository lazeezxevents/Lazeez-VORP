import { useState } from "react";
import { Bell, FileText, AlertTriangle, Wallet, ChevronRight, X, Activity, Circle, Volume2, BellRing } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { useNotifications } from "@/hooks/useNotifications";
import { useNotificationUIPreferences } from "@/hooks/useNotificationUIPreferences";
import { playSound } from "@/components/utils/soundEffects";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";

export function NotificationBell() {
    const navigate = useNavigate();
    const { 
        unreadNotifications, 
        unreadCount, 
        handleMarkAsRead 
    } = useNotifications();
    
    const { preferences: uiPrefs } = useNotificationUIPreferences();

    const previousCount = useRef(unreadCount);
    const [isPinging, setIsPinging] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const latestNotification = unreadNotifications[0];

    useEffect(() => {
        if (unreadCount > previousCount.current) {
            // Trigger effects for new notification based on user preferences
            if (uiPrefs.enable_popup_alerts) {
                setShowPopup(true);
            }
            
            if (uiPrefs.enable_sound) {
                // Play the user's preferred notification sound
                playSound(uiPrefs.notification_sound_type, { volume: uiPrefs.sound_volume });
            }
            
            // Reset popup only
            setTimeout(() => setShowPopup(false), uiPrefs.enable_popup_alerts ? 5000 : 0);
        }
        previousCount.current = unreadCount;
    }, [unreadCount, uiPrefs.enable_popup_alerts, uiPrefs.enable_sound, uiPrefs.notification_sound_type, uiPrefs.sound_volume]);

    // Continuous shaking if there are unread notifications
    const shouldShake = unreadCount > 0 && uiPrefs.enable_popup_alerts;

    // Handle bell click to trigger ring animation when there are no unread notifications
    const bellRef = useRef<HTMLButtonElement>(null);
    const handleBellClick = () => {
        if (unreadCount === 0) {
            // Play subtle "no notification" sound using our sound system
            if (uiPrefs.enable_sound) {
                playSound('bell_ring', { volume: uiPrefs.sound_volume * 0.5 });
            }
            
            if (bellRef.current) {
                bellRef.current.animate([
                    { transform: 'rotate(0)' },
                    { transform: 'rotate(-15deg)' },
                    { transform: 'rotate(15deg)' },
                    { transform: 'rotate(-10deg)' },
                    { transform: 'rotate(10deg)' },
                    { transform: 'rotate(0)' }
                ], {
                    duration: 500,
                    easing: 'ease-in-out'
                });
            }
        }
    };

    return (
        <div className="relative">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <motion.div
                        animate={shouldShake ? {
                            rotate: [0, -15, 15, -15, 15, 0],
                            transition: { 
                                duration: 1.5,
                                repeat: Infinity,
                                repeatType: "loop",
                                repeatDelay: 3 // Pause between shakes
                            }
                        } : {}}
                        className="relative"
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            ref={bellRef}
                            onClick={handleBellClick}
                            className="relative hover:bg-muted/50 transition-colors rounded-xl"
                        >
                            <Bell className="w-5 h-5 text-muted-foreground" />
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75 duration-1000"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border border-background shadow-sm shadow-rose-500/50"></span>
                                </span>
                            )}
                        </Button>
                    </motion.div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-0 border-none shadow-2xl bg-popover/95 backdrop-blur-xl border border-border/20 z-[9999]">
                    <div className="p-4 border-b border-border/30">
                        <div className="flex justify-between items-center">
                            <DropdownMenuLabel className="p-0 font-bold text-xs text-muted-foreground/80">
                                Alerts
                            </DropdownMenuLabel>
                            {unreadCount > 0 && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[9px] font-bold px-2 py-0.5">
                                    {unreadCount} new
                                </Badge>
                            )}
                        </div>
                    </div>
                    <div className="max-h-[380px] overflow-auto py-2 custom-scrollbar">
                        {unreadNotifications.length === 0 ? (
                            <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
                                <div className="relative w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                                    {/* Continuous glow effect */}
                                    <motion.div
                                        className="absolute inset-0 rounded-full bg-primary/20"
                                        animate={{
                                            opacity: [0.2, 0.5, 0.2],
                                            scale: [1, 1.1, 1],
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                        }}
                                    />
                                    
                                    {/* Continuous bell ring animation */}
                                    <motion.div
                                        className="relative z-10"
                                        animate={{ 
                                            rotate: [0, -15, 15, -15, 15, -10, 10, 0],
                                        }}
                                        transition={{ 
                                            duration: 0.8,
                                            ease: "easeInOut",
                                            repeat: Infinity,
                                            repeatDelay: 2
                                        }}
                                    >
                                        <BellRing className="w-6 h-6 text-primary" />
                                    </motion.div>
                                </div>
                                <div className="space-y-1 text-muted-foreground">
                                    <p className="text-sm font-bold text-slate-700">All caught up</p>
                                    <p className="text-[10px] font-medium max-w-[180px] leading-relaxed text-slate-500">No new alerts require your attention right now.</p>
                                </div>
                            </div>
                        ) : (
                            unreadNotifications.slice(0, 5).map((n) => (
                                <DropdownMenuItem
                                    key={n.id}
                                    className="px-4 py-3 cursor-pointer focus:bg-muted/50 transition-colors group mx-2 rounded-xl mb-1"
                                    onClick={() => {
                                        handleMarkAsRead(n.id);
                                        if (n.action_url) navigate(n.action_url);
                                    }}
                                >
                                    <div className="flex gap-4 items-start w-full">
                                        {n.metadata?.avatar_url ? (
                                            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-sm mt-0.5 border border-border/50 shrink-0">
                                                <img src={n.metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className={cn(
                                                "p-2 rounded-xl shadow-sm ring-1 ring-inset ring-black/5 mt-0.5",
                                                n.type === 'error' ? 'bg-rose-500/10 text-rose-500' : 
                                                n.type === 'warning' ? 'bg-amber-500/10 text-amber-500' : 
                                                'bg-primary/10 text-primary'
                                            )}>
                                                <Bell className="w-4 h-4" />
                                            </div>
                                        )}
                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between items-start">
                                                <p className="text-[11px] font-bold text-slate-800 font-montserrat tracking-tight leading-none pt-0.5 truncate max-w-[140px]">{n.title}</p>
                                                <span className="text-[9px] font-bold text-slate-400 font-poppins">Just now</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-medium line-clamp-2 leading-relaxed">
                                                {n.message}
                                            </p>
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                            ))
                        )}
                    </div>
                    <div className="p-2 border-t border-border/30">
                        <Button
                            variant="ghost"
                            className="w-full justify-center gap-2 text-[10px] font-bold text-primary hover:bg-primary/5 rounded-xl h-9"
                            onClick={() => navigate("/notifications")}
                        >
                            Manage all alerts <ChevronRight className="w-3 h-3" />
                        </Button>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* New Notification Popup Box with Bell Ring Animation */}
            <AnimatePresence>
                {showPopup && latestNotification && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="absolute top-14 right-0 w-72 p-0 bg-popover/95 backdrop-blur-xl border border-primary/20 shadow-2xl rounded-2xl z-[9999] group hover:shadow-primary/5 overflow-hidden"
                    >
                        <div 
                           className="p-3 cursor-pointer"
                           onClick={() => {
                               setShowPopup(false);
                               navigate("/notifications");
                           }}
                        >
                            <div className="flex gap-3 items-start">
                                {latestNotification.metadata?.avatar_url ? (
                                    <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm border border-primary/20 shrink-0">
                                        <img src={latestNotification.metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                        <motion.div
                                            animate={{ 
                                                rotate: [0, -15, 15, -15, 15, -10, 10, 0],
                                            }}
                                            transition={{ 
                                                duration: 0.6,
                                                ease: "easeInOut",
                                                repeat: 2
                                            }}
                                        >
                                            <BellRing className="w-3.5 h-3.5" />
                                        </motion.div>
                                    </div>
                                )}
                                <div className="space-y-0.5 min-w-0 pr-6">
                                    <p className="text-[10px] font-bold text-slate-800 truncate leading-tight mt-0.5">{latestNotification.title}</p>
                                    <p className="text-[9px] text-slate-500 line-clamp-2 leading-tight">{latestNotification.message}</p>
                                </div>
                            </div>
                            <div className="mt-2 text-[8px] font-bold text-primary flex items-center justify-end group-hover:underline">
                                View details <ChevronRight className="w-2 h-2 ml-1" />
                            </div>
                        </div>
                        <Button 
                           variant="ghost" 
                           size="icon" 
                           onClick={(e) => {
                               e.stopPropagation();
                               setShowPopup(false);
                           }} 
                           className="absolute top-1 right-1 h-6 w-6 rounded-full text-muted-foreground hover:bg-muted"
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
