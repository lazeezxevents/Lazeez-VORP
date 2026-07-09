import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Shield,
  Zap,
  Database,
  LogOut,
  Clock,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import lazeezLogo from "@/assets/lazeez-logo.png";
import { motion } from "framer-motion";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireStaff?: boolean;
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requireStaff = false,
  requireAdmin = false
}: ProtectedRouteProps) {
  const { user, isLoading, isStaff, isAdmin, isApproved, signOut, profile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 rounded-full border-t-2 border-primary border-r-2 border-primary/20"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 animate-pulse" />
            </div>
          </div>
          <p className="text-primary font-medium tracking-[0.2em] uppercase text-[10px]">Verifying Access</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Bypass for Master Admin
  const isMasterAdmin = user.email === "highypestudio@gmail.com";

  // Block unapproved users (Master Admin bypasses this screen)
  if (!isApproved && !isMasterAdmin) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden font-poppins">
        {/* Cinematic Backdrop Effects */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full animate-pulse-soft" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[100px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.015] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative z-10 p-4">

          {/* Left Side: System Information */}
          <div className="hidden md:flex flex-col space-y-12 pr-12">
            <div className="flex items-center gap-6">
              <img src={lazeezLogo} alt="Lazeez logo" className="h-16 w-auto drop-shadow-md" />
              <div className="h-12 w-[1px] bg-primary/20" />
              <span className="text-[11px] font-bold tracking-[0.4em] text-primary/60 uppercase">Internal Gateway</span>
            </div>

            <div className="space-y-6">
              <motion.h1
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-foreground"
              >
                Access <span className="text-primary">Verification</span>
              </motion.h1>
              <p className="text-xl text-muted-foreground/80 leading-relaxed font-light max-w-lg">
                Your organizational account is being synchronized with our internal security protocols. Manual clearance ensures a densed, high-integrity ecosystem.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-10">
              {[
                { icon: Shield, title: "Organizational Identity", desc: "Access is governed by strict internal role-based security policies." },
                { icon: Zap, title: "Operational Infrastructure", desc: "Internal tools for automated contract extraction and tracking." },
                { icon: Database, title: "Centralized Ecosystem", desc: "Unified management for all vendor operations and resources." }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="flex gap-8 group"
                >
                  <div className="w-16 h-16 rounded-[24px] bg-primary/[0.03] border border-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-all duration-500 group-hover:scale-105 group-hover:rotate-3 shadow-sm">
                    <item.icon className="w-8 h-8 text-primary/80" />
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">{item.title}</h3>
                    <p className="text-sm text-muted-foreground/60 leading-relaxed font-light">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Side: Status Panel */}
          <div className="flex flex-col items-center w-full">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md bg-white p-10 md:p-14 rounded-[56px] shadow-[0_50px_100px_-30px_rgba(0,0,0,0.08)] border border-primary/5 space-y-12 relative overflow-hidden group"
            >
              {/* Luxury Detail: Animated Glass Highlight */}
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent skew-x-12 pointer-events-none"
              />

              <div className="flex flex-col items-center text-center space-y-8">
                <div className="relative scale-110">
                  <motion.div
                    animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 5, repeat: Infinity }}
                    className="absolute inset-[-15px] bg-amber-400/20 blur-3xl rounded-full"
                  />
                  <div className="relative w-28 h-28 bg-white border border-amber-100 rounded-[40px] flex items-center justify-center shadow-[0_10px_25px_rgba(245,158,11,0.08)]">
                    <Lock className="w-12 h-12 text-amber-600 drop-shadow-sm" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">Awaiting Entry</h2>
                  <p className="text-muted-foreground text-sm font-light">
                    Portal: <span className="text-primary font-semibold underline decoration-primary/20 underline-offset-4">{user.email}</span>
                  </p>
                </div>
              </div>

              {/* Enhanced Stepper */}
              <div className="space-y-10 relative px-2">
                <div className="flex items-center gap-7 relative">
                  <div className="absolute left-[19px] top-11 w-[1.5px] h-10 bg-green-500/20" />
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0 shadow-lg shadow-green-500/20 relative z-10">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground text-lg">Account Initialized</p>
                    <p className="text-[11px] text-green-600 font-bold uppercase tracking-wider">Completed</p>
                  </div>
                </div>

                <div className="flex items-center gap-7 relative">
                  <div className={`absolute left-[19px] top-11 w-[1.5px] h-10 ${(profile as any)?.admin_approved_by ? 'bg-green-500/20' : 'bg-border/40'}`} />
                  <motion.div
                    animate={!(profile as any)?.admin_approved_by ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 3, repeat: Infinity }}
                    className={`w-10 h-10 rounded-full ${(profile as any)?.admin_approved_by ? 'bg-green-500' : 'bg-amber-500'} flex items-center justify-center shrink-0 shadow-lg ${(profile as any)?.admin_approved_by ? 'shadow-green-500/20' : 'shadow-amber-500/30'} relative z-10`}
                  >
                    {(profile as any)?.admin_approved_by ? (
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    ) : (
                      <Clock className="w-5 h-5 text-white animate-spin-slow" />
                    )}
                  </motion.div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground text-lg">Internal Audit</p>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${(profile as any)?.admin_approved_by ? 'text-green-600' : 'text-amber-600 animate-pulse'}`}>
                      {(profile as any)?.admin_approved_by ? 'Cleared' : 'Processing Clearance'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-7 relative">
                  <div className={`absolute left-[19px] top-11 w-[1.5px] h-10 ${(profile as any)?.hr_approved_by ? 'bg-green-500/20' : 'bg-border/40'}`} />
                  <motion.div
                    animate={(profile as any)?.admin_approved_by && !(profile as any)?.hr_approved_by ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 3, repeat: Infinity }}
                    className={`w-10 h-10 rounded-full ${(profile as any)?.hr_approved_by ? 'bg-green-500' : (profile as any)?.admin_approved_by ? 'bg-amber-500' : 'bg-muted/30 border border-muted/50'} flex items-center justify-center shrink-0 ${(profile as any)?.hr_approved_by ? 'shadow-lg shadow-green-500/20' : (profile as any)?.admin_approved_by ? 'shadow-lg shadow-amber-500/30' : ''} relative z-10`}
                  >
                    {(profile as any)?.hr_approved_by ? (
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    ) : (profile as any)?.admin_approved_by ? (
                      <Clock className="w-5 h-5 text-white animate-spin-slow" />
                    ) : (
                      <UserCheck className="w-5 h-5 text-muted-foreground/20" />
                    )}
                  </motion.div>
                  <div className="flex-1">
                    <p className={`font-bold text-lg ${(profile as any)?.hr_approved_by || (profile as any)?.admin_approved_by ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                      HR Processing
                    </p>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${(profile as any)?.hr_approved_by ? 'text-green-600' : (profile as any)?.admin_approved_by ? 'text-amber-600 animate-pulse' : 'text-muted-foreground/30'}`}>
                      {(profile as any)?.hr_approved_by ? 'Completed' : (profile as any)?.admin_approved_by ? 'In Progress' : 'Awaiting Audit'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-7">
                  <div className={`w-10 h-10 rounded-full ${profile?.is_approved ? 'bg-green-500 shadow-lg shadow-green-500/20' : 'bg-muted/30 border border-muted/50'} flex items-center justify-center shrink-0 relative z-10`}>
                    {profile?.is_approved ? (
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    ) : (
                      <ShieldCheck className="w-5 h-5 text-muted-foreground/20" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold text-lg ${profile?.is_approved ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                      Ecosystem Access
                    </p>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${profile?.is_approved ? 'text-green-600' : 'text-muted-foreground/30'}`}>
                      {profile?.is_approved ? 'Granted' : 'Locked'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 rounded-[32px] bg-primary/[0.02] border border-primary/5 space-y-4 shadow-inner">
                <div className="flex items-center gap-3 text-primary/60">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em]">System Advisory</span>
                </div>
                <p className="text-[13px] text-foreground/60 leading-relaxed font-light italic">
                  "Your credentials are valid. The administration team verifies internal accounts within a synchronized timeframe of 2-4 hours."
                </p>
              </div>

              <div className="flex gap-4 pt-6">
                <Button
                  className="flex-1 h-16 rounded-[24px] bg-primary hover:bg-primary/95 text-primary-foreground shadow-2xl shadow-primary/20 text-lg font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => window.location.reload()}
                >
                  Verify Now
                </Button>
                <Button
                  variant="outline"
                  className="w-16 h-16 p-0 rounded-[24px] border-primary/10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all group/btn"
                  onClick={async () => {
                    await signOut();
                    window.location.href = "/";
                  }}
                >
                  <LogOut className="w-7 h-7 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin && !isMasterAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireStaff && !isStaff && !isMasterAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
