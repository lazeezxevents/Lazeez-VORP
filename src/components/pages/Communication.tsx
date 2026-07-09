import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout';
import { DepartmentSidebar } from '@/components/communication/DepartmentSidebarWithDnD';
import { ChannelView } from '@/components/communication/ChannelView';
import { DirectMessageView } from '@/components/communication/direct-messages/DirectMessageView';
import { MessageSquare, Users, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChannelUnreadMapQuery } from '@/components/hooks/useChannelUnreadMapQuery';

const COMMUNICATION_TAB_TITLE_BASE = 'Lazeez Vendor Operations and Resource Platform.';

/**
 * Communication Page - Main entry point for the Communication Module
 *
 * Layout:
 * - Channels: narrow sidebar (departments/channels) + main channel view
 * - Direct messages: full-width split (list + chat) below the mode switcher — never nested inside w-80
 */
const Communication: React.FC = () => {
  const [selectedChannel, setSelectedChannel] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'channels' | 'direct-messages'>('channels');
  const { data: unreadPack } = useChannelUnreadMapQuery();

  useEffect(() => {
    const total = unreadPack?.total ?? 0;
    document.title =
      total > 0 ? `(${total}) ${COMMUNICATION_TAB_TITLE_BASE}` : COMMUNICATION_TAB_TITLE_BASE;
  }, [unreadPack?.total]);

  useEffect(() => {
    return () => {
      document.title = COMMUNICATION_TAB_TITLE_BASE;
    };
  }, []);

  const handleChannelSelect = (channelId: string, channelName: string) => {
    setSelectedChannel({ id: channelId, name: channelName });
    setViewMode('channels');
  };

  const viewSwitcher = (
    <div className="p-3 border-b border-border bg-card flex-shrink-0">
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        <Button
          variant={viewMode === 'channels' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('channels')}
          className="flex-1 text-xs"
        >
          <Hash className="w-3 h-3 mr-1" />
          Channels
        </Button>
        <Button
          variant={viewMode === 'direct-messages' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('direct-messages')}
          className="flex-1 text-xs"
        >
          <Users className="w-3 h-3 mr-1" />
          Messages
        </Button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col min-h-0">
        {viewMode === 'channels' ? (
          <div className="flex flex-1 min-h-0">
            <div className="w-80 border-r border-border bg-card flex flex-col flex-shrink-0">
              {viewSwitcher}
              <div className="flex-1 min-h-0 overflow-hidden">
                <DepartmentSidebar onChannelSelect={handleChannelSelect} />
              </div>
            </div>
            <div className="flex-1 bg-background overflow-hidden min-w-0">
              {selectedChannel ? (
                <ChannelView
                  channelId={selectedChannel.id}
                  channelName={selectedChannel.name}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <MessageSquare className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Welcome to Communication</h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-4">
                    Select a channel from the sidebar to start messaging.
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1 text-left max-w-md">
                    <p>
                      <span className="font-medium text-foreground">Tip:</span> the #general channel is pinned for everyone.
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Tip:</span> drag departments in the sidebar to reorder them.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {viewSwitcher}
            <div className="flex-1 min-h-0 overflow-hidden">
              <DirectMessageView />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Communication;
