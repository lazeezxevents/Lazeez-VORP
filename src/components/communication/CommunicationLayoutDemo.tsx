import { CommunicationLayout, CommunicationSidebarContainer, CommunicationContentContainer } from "./CommunicationLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash, Lock, Users } from "lucide-react";
import { motion } from "framer-motion";

/**
 * CommunicationLayoutDemo - Demonstration component showing the layout in action
 * 
 * This component demonstrates:
 * - Sidebar with department/channel structure
 * - Main content area with message display
 * - Responsive behavior
 * - Dark mode support
 */
export const CommunicationLayoutDemo = () => {
  // Mock data for demonstration
  const departments = [
    {
      id: "1",
      name: "Engineering",
      channels: [
        { id: "1-1", name: "general", isPrivate: false, unreadCount: 3 },
        { id: "1-2", name: "frontend", isPrivate: false, unreadCount: 0 },
        { id: "1-3", name: "backend", isPrivate: false, unreadCount: 1 },
        { id: "1-4", name: "security", isPrivate: true, unreadCount: 0 },
      ],
    },
    {
      id: "2",
      name: "Operations",
      channels: [
        { id: "2-1", name: "general", isPrivate: false, unreadCount: 0 },
        { id: "2-2", name: "vendors", isPrivate: false, unreadCount: 5 },
        { id: "2-3", name: "logistics", isPrivate: false, unreadCount: 0 },
      ],
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -8 },
    visible: { opacity: 1, x: 0 },
  };

  const sidebar = (
    <CommunicationSidebarContainer>
      {/* Sidebar Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-lg">Channels</h2>
        <p className="text-sm text-muted-foreground">Your departments and channels</p>
      </div>

      {/* Departments and Channels */}
      <ScrollArea className="flex-1">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="p-2 space-y-4"
        >
          {departments.map((department) => (
            <motion.div key={department.id} variants={itemVariants}>
              <div className="px-2 py-1.5 mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{department.name}</span>
                </div>
              </div>

              <div className="space-y-1">
                {department.channels.map((channel) => (
                  <motion.button
                    key={channel.id}
                    whileHover={{ x: 4, backgroundColor: "hsl(var(--accent))" }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {channel.isPrivate ? (
                        <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="truncate">{channel.name}</span>
                    </div>
                    {channel.unreadCount > 0 && (
                      <Badge
                        variant="default"
                        className="ml-2 h-5 min-w-[20px] px-1.5 text-xs flex-shrink-0"
                      >
                        {channel.unreadCount}
                      </Badge>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </ScrollArea>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {departments.reduce((acc, dept) => acc + dept.channels.length, 0)} channels
        </p>
      </div>
    </CommunicationSidebarContainer>
  );

  return (
    <CommunicationLayout sidebar={sidebar}>
      <CommunicationContentContainer>
        {/* Content Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-lg">general</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            General discussion for the Engineering department
          </p>
        </div>

        {/* Message Area */}
        <ScrollArea className="flex-1 p-4">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div key={i} variants={itemVariants}>
                <Card className="hover-lift transition-all duration-300">
                  <CardHeader>
                    <CardTitle className="text-base">Sample Message {i}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      This is a demonstration of the communication layout. The sidebar shows
                      departments and channels, while this area displays messages.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </ScrollArea>

        {/* Message Composer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Send
            </button>
          </div>
        </div>
      </CommunicationContentContainer>
    </CommunicationLayout>
  );
};
