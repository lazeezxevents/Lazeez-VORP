import { useState } from "react";
import { MessageComposer } from "./MessageComposer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

/**
 * MessageComposerDemo - Demonstration component for MessageComposer
 * 
 * Shows the MessageComposer component in action with simulated message sending.
 */
export const MessageComposerDemo = () => {
  const [messages, setMessages] = useState<Array<{ content: string; attachments: number }>>([]);

  const handleSendMessage = async (content: string, attachments: File[]) => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Add message to list
    setMessages((prev) => [
      ...prev,
      {
        content,
        attachments: attachments.length,
      },
    ]);

    console.log("Message sent:", { content, attachments: attachments.map(f => f.name) });
  };

  const handleTypingStart = () => {
    console.log("User started typing");
  };

  const handleTypingStop = () => {
    console.log("User stopped typing");
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>MessageComposer Demo</CardTitle>
          <CardDescription>
            A rich text message composer with formatting, emoji picker, and file attachments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Feature list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Multi-line input (Shift+Enter for newline)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Character counter (4000 limit)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Markdown formatting (bold, italic, code)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Emoji picker with common emojis</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>File attachments (drag & drop)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Draft auto-save to localStorage</span>
            </div>
          </div>

          {/* Sent messages display */}
          {messages.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
              <h3 className="font-semibold text-sm">Sent Messages:</h3>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {messages.map((msg, idx) => (
                  <div key={idx} className="text-sm p-2 bg-background rounded border">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.attachments > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        📎 {msg.attachments} attachment{msg.attachments > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MessageComposer */}
          <div className="border rounded-lg overflow-hidden">
            <MessageComposer
              channelId="demo-channel"
              channelName="general"
              placeholder="Try typing a message..."
              onSendMessage={handleSendMessage}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
            />
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Tips:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Press <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-muted rounded">Shift+Enter</kbd> for new line</li>
              <li>Use formatting buttons or type <code>**bold**</code>, <code>*italic*</code>, <code>`code`</code></li>
              <li>Click emoji button or drag files to attach</li>
              <li>Your draft is auto-saved and will persist across page reloads</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
