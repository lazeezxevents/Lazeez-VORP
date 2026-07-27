import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Clock,
  User,
  Calendar,
  Tag,
  AlertCircle,
  MessageSquare,
  Eye,
  EyeOff,
  Paperclip,
  Download,
  Trash2,
  Send,
  Loader2,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/components/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { Issue } from "@/hooks/useIssues";
import {
  useIssueActivity,
  useIssueChatMessages,
  useSendChatMessage,
  useIssueWatchers,
  useAddWatcher,
  useRemoveWatcher,
  useIssueAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from "@/components/hooks/useIssueEnhancements";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface IssueDetailPanelProps {
  issue: Issue | null;
  onClose: () => void;
}

const priorityConfig = {
  low: { color: "bg-priority-low/10 text-priority-low border-priority-low/20", icon: AlertCircle },
  medium: { color: "bg-priority-medium/10 text-priority-medium border-priority-medium/20", icon: AlertCircle },
  high: { color: "bg-priority-high/10 text-priority-high border-priority-high/20", icon: AlertCircle },
  critical: { color: "bg-priority-critical/10 text-priority-critical border-priority-critical/20", icon: AlertCircle },
};

const statusConfig = {
  open: { color: "bg-info/10 text-info", icon: Clock },
  in_progress: { color: "bg-warning/10 text-warning", icon: Clock },
  resolved: { color: "bg-success/10 text-success", icon: Clock },
  closed: { color: "bg-muted text-muted-foreground", icon: Clock },
};

export const IssueDetailPanel = ({ issue, onClose }: IssueDetailPanelProps) => {
  const { user } = useAuth();
  const [chatMessage, setChatMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Queries
  const { data: activity = [] } = useIssueActivity(issue?.id || "");
  const { data: chatMessages = [] } = useIssueChatMessages(issue?.id || "");
  const { data: watchers = [] } = useIssueWatchers(issue?.id || "");
  const { data: attachments = [] } = useIssueAttachments(issue?.id || "");

  // Mutations
  const sendMessage = useSendChatMessage(issue?.id || "");
  const addWatcher = useAddWatcher(issue?.id || "");
  const removeWatcher = useRemoveWatcher(issue?.id || "");
  const uploadAttachment = useUploadAttachment(issue?.id || "");
  const deleteAttachment = useDeleteAttachment();

  const isWatching = watchers.some((w) => w.user_id === user?.id);

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !issue) return;
    
    try {
      await sendMessage.mutateAsync({ content: chatMessage });
      setChatMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleToggleWatch = async () => {
    if (!user || !issue) return;

    if (isWatching) {
      const myWatcher = watchers.find((w) => w.user_id === user.id);
      if (myWatcher) {
        await removeWatcher.mutateAsync(myWatcher.id);
        toast.success("You are no longer watching this issue");
      }
    } else {
      await addWatcher.mutateAsync(user.id);
      toast.success("You are now watching this issue");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const handleUploadAttachments = async () => {
    if (selectedFiles.length === 0 || !issue) return;

    for (const file of selectedFiles) {
      try {
        await uploadAttachment.mutateAsync(file);
      } catch (error) {
        console.error("Failed to upload:", error);
      }
    }
    setSelectedFiles([]);
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    const attachment = attachments.find((a) => a.id === attachmentId);
    if (!attachment) return;

    if (confirm(`Delete ${attachment.file_name}?`)) {
      await deleteAttachment.mutateAsync({ attachment });
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return ImageIcon;
    if (fileType.includes("pdf")) return FileText;
    return FileIcon;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!issue) return null;

  const PriorityIcon = priorityConfig[issue.priority].icon;
  const StatusIcon = statusConfig[issue.status].icon;

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 h-full w-full md:w-[600px] bg-background border-l shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Badge className={statusConfig[issue.status].color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {issue.status.replace("_", " ")}
          </Badge>
          <h2 className="font-semibold text-lg truncate">{issue.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={isWatching ? "default" : "ghost"}
                onClick={handleToggleWatch}
                disabled={removeWatcher.isPending || addWatcher.isPending}
              >
                {isWatching ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isWatching ? "Stop watching" : "Watch issue"}
            </TooltipContent>
          </Tooltip>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="details" className="h-full flex flex-col">
          <TabsList className="w-full grid grid-cols-4 px-4 pt-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="chat">
              Chat
              {chatMessages.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {chatMessages.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attachments">
              Files
              {attachments.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {attachments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="watchers">
              Watchers
              {watchers.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {watchers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="flex-1 overflow-hidden px-4 pb-4">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {/* Priority & Status */}
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <PriorityIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Priority</span>
                      </div>
                      <Badge className={cn("mt-2", priorityConfig[issue.priority].color)}>
                        {issue.priority}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Assigned</span>
                      </div>
                      <p className="mt-2 text-sm truncate">
                        {issue.assignee?.full_name || "Unassigned"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Description */}
                {issue.description && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-medium mb-2">Description</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {issue.description}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Metadata */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Created:</span>
                      <span>{format(new Date(issue.created_at), "PPp")}</span>
                    </div>
                    {issue.due_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Due:</span>
                        <span
                          className={
                            new Date(issue.due_date) < new Date()
                              ? "text-destructive font-medium"
                              : ""
                          }
                        >
                          {format(new Date(issue.due_date), "PPp")}
                        </span>
                      </div>
                    )}
                    {issue.vendor && (
                      <div className="flex items-center gap-2 text-sm">
                        <Tag className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Vendor:</span>
                        <span>{issue.vendor.name}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Activity Log */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-3">Activity</h3>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {activity.map((item) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex gap-3 text-sm"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {item.user?.full_name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {item.user?.full_name || "Unknown"}
                                </span>{" "}
                                {item.action_type.replace("_", " ")}
                                {item.old_value && (
                                  <span className="line-through mx-1">{item.old_value}</span>
                                )}
                                {item.new_value && (
                                  <span className="font-medium mx-1">{item.new_value}</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(item.created_at), {
                                  addSuffix: true,
                                })}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="flex-1 overflow-hidden flex flex-col px-4 pb-4">
            <ScrollArea className="flex-1 mb-4">
              <div className="space-y-4">
                {chatMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={msg.user?.avatar_url || undefined} />
                      <AvatarFallback>
                        {msg.user?.full_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-sm">
                          {msg.user?.full_name || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(msg.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
            <div className="space-y-2">
              <Textarea
                placeholder="Type a message..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={3}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!chatMessage.trim() || sendMessage.isPending}
                className="w-full"
              >
                {sendMessage.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Message
              </Button>
            </div>
          </TabsContent>

          {/* Attachments Tab */}
          <TabsContent value="attachments" className="flex-1 overflow-hidden px-4 pb-4">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {/* Upload Section */}
                <Card>
                  <CardContent className="p-4">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload">
                      <Button variant="outline" className="w-full" asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          Select Files
                        </span>
                      </Button>
                    </label>
                    {selectedFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                          >
                            <span className="truncate">{file.name}</span>
                            <span className="text-muted-foreground">
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                        ))}
                        <Button
                          onClick={handleUploadAttachments}
                          disabled={uploadAttachment.isPending}
                          className="w-full"
                        >
                          {uploadAttachment.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4 mr-2" />
                          )}
                          Upload {selectedFiles.length} file(s)
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Attachments List */}
                <div className="space-y-2">
                  {attachments.map((att) => {
                    const Icon = getFileIcon(att.file_type || "");
                    return (
                      <Card key={att.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {att.file_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(att.file_size || 0)} •{" "}
                                {format(new Date(att.created_at), "PPp")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              asChild
                            >
                              <a href={att.file_url} download target="_blank" rel="noopener noreferrer">
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                            {att.uploaded_by === user?.id && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteAttachment(att.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Watchers Tab */}
          <TabsContent value="watchers" className="flex-1 overflow-hidden px-4 pb-4">
            <ScrollArea className="h-full">
              <div className="space-y-3">
                {watchers.map((watcher) => (
                  <Card key={watcher.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={watcher.user?.avatar_url || undefined} />
                          <AvatarFallback>
                            {watcher.user?.full_name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {watcher.user?.full_name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {watcher.user?.email}
                          </p>
                        </div>
                      </div>
                      {watcher.user_id === user?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeWatcher.mutateAsync(watcher.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
};
