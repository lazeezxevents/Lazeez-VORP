import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/components/lib/utils";
import { useSearch } from "@/components/hooks/useSearch";
import { SearchModal } from "@/components/communication/search/SearchModal";
import { IncomingCallManager } from "@/components/communication/webrtc/IncomingCallManager";
import { useUnreadTracking } from "@/components/hooks/useUnreadTracking";

interface CommunicationLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

/**
 * CommunicationLayout - Main layout component for the communication module
 * 
 * Features:
 * - Fixed sidebar (280px) on desktop
 * - Mobile drawer with hamburger menu
 * - Responsive breakpoints (640px, 768px, 1024px)
 * - Dark mode support via next-themes
 * - Smooth animations with Framer Motion
 * 
 * Requirements: 22.4, 22.13, 27.2, 27.3
 */
export const CommunicationLayout = ({ children, sidebar }: CommunicationLayoutProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isSearchOpen, openSearch, closeSearch, handleNavigateToMessage, handleNavigateToChannel, handleNavigateToUser } = useSearch();
  const { totalUnread } = useUnreadTracking();

  // Update browser tab title with unread count
  // Requirement: 35.5
  useEffect(() => {
    const originalTitle = document.title;
    
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) ${originalTitle.replace(/^\(\d+\)\s*/, '')}`;
    } else {
      document.title = originalTitle.replace(/^\(\d+\)\s*/, '');
    }

    return () => {
      document.title = originalTitle;
    };
  }, [totalUnread]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar - Hidden on mobile (<768px) */}
      <motion.aside
        initial={{ x: -320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="hidden md:flex md:w-[320px] lg:w-[320px] border-r border-border bg-background flex-col"
      >
        {sidebar}
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header with Hamburger Menu */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[320px] p-0"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {sidebar}
              </motion.div>
            </SheetContent>
          </Sheet>

          <h1 className="font-semibold text-lg">Communication</h1>
          
          {/* Mobile search button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => {/* Search will open with Cmd/Ctrl+K */}}
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={closeSearch}
        onNavigateToMessage={handleNavigateToMessage}
        onNavigateToChannel={handleNavigateToChannel}
        onNavigateToUser={handleNavigateToUser}
      />

      {/* Incoming Call Notifications */}
      <IncomingCallManager
        onAcceptCall={(callId, callType, channelId) => {
          console.log('[CommunicationLayout] Accepting call:', { callId, callType, channelId });
          // TODO: Navigate to call interface or open CallInterface modal
          // This will be implemented when integrating with the full call flow
        }}
        onRejectCall={(callId) => {
          console.log('[CommunicationLayout] Rejecting call:', callId);
        }}
      />
    </div>
  );
};

/**
 * CommunicationSidebarContainer - Container for sidebar content with consistent styling
 */
export const CommunicationSidebarContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col h-full bg-background">
      {children}
    </div>
  );
};

/**
 * CommunicationContentContainer - Container for main content area with consistent styling
 */
export const CommunicationContentContainer = ({ 
  children, 
  className 
}: { 
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {children}
    </div>
  );
};
