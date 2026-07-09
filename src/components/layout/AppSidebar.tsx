import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Ticket,
  FileText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building2,
  Bell,
  History,
  CalendarDays,
  UserCheck,
  FolderLock,
  TrendingUp,
  Briefcase,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import lazeezLogo from "@/assets/lazeez-logo.png";
import lazeezLogoWhite from "@/assets/Lazeez Events  - Logo - White_Logo - Main copy 12.png";
import lazeezIcon from "@/assets/Lazeez Events  - Logo _Icon .png";
import lazeezIconWhite from "@/assets/Lazeez Events  - Logo _Icon  copy 2.png";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";

interface SidebarProps {
  className?: string;
  collapsed: boolean;
  onToggle: (collapsed: boolean) => void;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Building2, label: "Vendors", href: "/vendors", permission: "vendors.view" },
  { icon: Ticket, label: "Issues", href: "/issues", permission: "issues.view" },
  { icon: FileText, label: "MOUs", href: "/mous", permission: "mous.view" },
  { icon: FolderLock, label: "MOU Vault", href: "/mou-vault", permission: "mous.vault" },
  { icon: MessageSquare, label: "Communication", href: "/communication" },
  { icon: CalendarDays, label: "Calendar", href: "/calendar", permission: "calendar.view" },
  { icon: BarChart3, label: "Analytics", href: "/analytics", permission: "analytics.view" },
  { icon: Briefcase, label: "Projects", href: "/projects", permission: "projects.view" },
  { icon: DollarSign, label: "Finance", href: "/finance", permission: "finance.view" },
  { icon: TrendingUp, label: "HR / Performance", href: "/hr-performance", permission: "hr.view" },
  { icon: History, label: "Audit Logs", href: "/audit-logs", permission: "audit.view" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
];

const bottomNavItems = [
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function AppSidebar({ className, collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin, hasPermission, isManager, isHR, isStaff } = useAuth();
  const { unreadCount } = useNotifications();
  const { theme } = useTheme();

  const playNavSound = () => {
    try {
      // Subtle click release sound
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3");
      audio.volume = 0.15;
      audio.play().catch(() => {});
    } catch(e) {}
  };

  const handleLogout = async () => {
    await signOut();
    // Safety fallback
    setTimeout(() => {
      window.location.href = "/";
    }, 100);
  };

  const currentLogo = theme === "dark"
    ? (collapsed ? lazeezIconWhite : lazeezLogoWhite)
    : (collapsed ? lazeezIcon : lazeezLogo);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 flex flex-col",
        "bg-white/85 dark:bg-card/85 backdrop-blur-xl border-r border-border/50",
        "shadow-[0_8px_32px_rgba(0,0,0,0.08)]",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Logo Section */}
      <div className="flex items-center h-20 px-4 border-b border-border/30 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={theme + (collapsed ? "-collapsed" : "-expanded")}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center w-full"
          >
            <img
              src={currentLogo}
              alt="Lazeez Events"
              className={cn(
                "transition-all duration-300",
                collapsed
                  ? "h-12 w-12 object-contain"
                  : (theme === "dark" ? "h-16 scale-110 w-auto object-contain" : "h-14 w-auto object-contain")
              )}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isRestricted = item.label === "HR / Performance" || item.label === "Audit Logs" || item.label === "Finance";
          const canSeeRestricted = isAdmin || isManager || isHR || isStaff;

          if (isRestricted && !canSeeRestricted) {
            return null;
          }

          // Existing Permission Check
          if ((item as any).permission && !hasPermission((item as any).permission)) {
            return null;
          }

          const isActive = location.pathname === item.href ||
            (item.href !== "/dashboard" && location.pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={playNavSound}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className={cn(
                "transition-transform duration-200 group-hover:scale-110 flex-shrink-0",
                collapsed ? "w-6 h-6" : "w-5 h-5",
                isActive && "drop-shadow-sm"
              )} />
              {!collapsed && (
                <span className="font-medium text-sm truncate flex-1">{item.label}</span>
              )}
              {item.label === "Notifications" && unreadCount > 0 && !collapsed && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "ml-auto px-1.5 py-0 min-w-[18px] h-5 flex items-center justify-center text-[10px] font-bold rounded-full",
                    isActive ? "bg-white text-primary" : "bg-primary text-white shadow-sm"
                  )}
                >
                  {unreadCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="py-4 px-2 border-t border-border/30 space-y-1">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium text-sm truncate">{item.label}</span>}
            </Link>
          );
        })}

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="font-medium text-sm">Logout</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => onToggle(!collapsed)}
        className="absolute -right-3 top-24 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm hover:scale-110 active:scale-95 z-50"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}
