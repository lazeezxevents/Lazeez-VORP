import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Shield, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { UnifiedNotificationSettings } from "@/components/settings/UnifiedNotificationSettings";
import { CommunicationSettings } from "@/components/settings/CommunicationSettings";
import { CustomRoleManager as PermissionSettings } from "@/components/settings/CustomRoleManager";

export default function Settings() {
    const { hasPermission } = useAuth();
    const [activeTab, setActiveTab] = useState("profile");

    return (
        <DashboardLayout title="Settings" subtitle="Manage your account and preferences">
            <div className="space-y-6 animate-fade-in">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto p-1 max-w-3xl mx-auto">
                        <TabsTrigger value="profile" className="flex items-center gap-2 py-2">
                            <User className="w-4 h-4" />
                            <span className="hidden sm:inline">Profile</span>
                        </TabsTrigger>
                        <TabsTrigger value="notifications" className="flex items-center gap-2 py-2">
                            <Bell className="w-4 h-4" />
                            <span className="hidden sm:inline">Notifications</span>
                        </TabsTrigger>
                        <TabsTrigger value="communication" className="flex items-center gap-2 py-2">
                            <MessageSquare className="w-4 h-4" />
                            <span className="hidden sm:inline">Communication</span>
                        </TabsTrigger>
                        {hasPermission("users.manage") && (
                            <TabsTrigger value="permissions" className="flex items-center gap-2 py-2">
                                <Shield className="w-4 h-4" />
                                <span className="hidden sm:inline">Roles & Access</span>
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="profile">
                        <ProfileSettings />
                    </TabsContent>

                    <TabsContent value="notifications">
                        <UnifiedNotificationSettings />
                    </TabsContent>

                    <TabsContent value="communication">
                        <CommunicationSettings />
                    </TabsContent>

                    {hasPermission("users.manage") && (
                        <TabsContent value="permissions">
                            <PermissionSettings />
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
