import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, User, Mail, Phone, Building2, BadgeCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDesignations, useUpdateUserProfile, useDepartments } from "@/hooks/useUsers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ProfileSettings() {
  const { user, profile, role, refreshProfile, updateProfileOptimistic, isAdmin, hasPermission } = useAuth();
  const { data: designations } = useDesignations();
  const { data: departments } = useDepartments();
  const updateProfile = useUpdateUserProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  // Check if user can edit department/designation
  const canEditDepartment = isAdmin || hasPermission("users.manage") || hasPermission("hr.manage");

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    department_id: profile?.department_id || "",
    designation_id: profile?.designation_id || "",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        department_id: profile.department_id || "",
        designation_id: profile.designation_id || "",
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    await updateProfile.mutateAsync({
      userId: user.id,
      ...formData,
      department_id: formData.department_id || null,
      // Empty string or "none" sentinel both become null
      designation_id: formData.designation_id && formData.designation_id !== "none"
        ? formData.designation_id
        : null,
    });

    // Refresh the profile in auth context so changes are reflected immediately
    await refreshProfile();
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    // Instant local preview and optimistic global update
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);

    // Save previous avatar for rollback on error
    const previousAvatarUrl = profile?.avatar_url || null;
    updateProfileOptimistic({ avatar_url: previewUrl });

    setUploading(true);
    try {
      // Create file path: userId/avatar.ext
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL with cache-busting timestamp
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL
      await updateProfile.mutateAsync({
        userId: user.id,
        avatar_url: cacheBustedUrl,
      });

      // Optimistically update again with the real URL instead of local blob
      updateProfileOptimistic({ avatar_url: cacheBustedUrl });

      // Refresh auth context so all avatars across the app stay in sync with database
      await refreshProfile();

      toast.success("Avatar updated successfully");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar");
      // Revert local preview and optimistic update on error
      setLocalPreview(null);
      updateProfileOptimistic({ avatar_url: previousAvatarUrl });
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const roleLabels: Record<string, string> = {
    admin: "Administrator",
    ops_manager: "Operations Manager",
    hr: "HR Manager",
    employee: "Employee",
  };

  const getRoleLabel = () => {
    if (role === 'admin') return "Administrator";
    if (role === 'ops_manager') return "Operations Manager";
    // Check if the profile has a matching department or designation that implies HR
    if (profile?.department === 'HR') return "HR Manager";
    return "Employee";
  };

  const avatarUrl = localPreview || profile?.avatar_url;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Manage your personal information and account details
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4 pb-6 border-b">
            <div className="relative group">
              <Avatar className="w-24 h-24 border-4 border-primary/20">
                <AvatarImage src={avatarUrl} alt={profile?.full_name || "User"} />
                <AvatarFallback className="text-2xl gradient-primary text-primary-foreground">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg">{profile?.full_name || "User"}</h3>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <BadgeCheck className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  {getRoleLabel()}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Click avatar to upload a new photo
            </p>
          </div>

          {/* User ID Display */}
          <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              User ID
            </Label>
            <p className="font-mono text-sm bg-background p-2 rounded border">
              {user?.id || "N/A"}
            </p>
          </div>

          {/* Form Fields */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
              </Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input
                value={profile?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Number
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+92 300 1234567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Department
              </Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                disabled={!canEditDepartment}
              >
                <SelectTrigger id="department" className={!canEditDepartment ? "bg-muted cursor-not-allowed" : ""}>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canEditDepartment && (
                <p className="text-[10px] text-muted-foreground">
                  Contact HR or Admin to change department
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="designation">Designation</Label>
              <Select
                value={formData.designation_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, designation_id: value === "none" ? "" : value })
                }
                disabled={!canEditDepartment}
              >
                <SelectTrigger className={!canEditDepartment ? "bg-muted cursor-not-allowed" : ""}>
                  <SelectValue placeholder="Select your designation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {designations?.map((designation) => (
                    <SelectItem key={designation.id} value={designation.id}>
                      {designation.display_name || designation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canEditDepartment && (
                <p className="text-[10px] text-muted-foreground">
                  Contact HR or Admin to change designation
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full gradient-primary"
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
