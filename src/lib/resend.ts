import { toast } from "sonner";

// Note: In a production environment, this should ideally be called from a secure backend
// or Supabase Edge Function to protect the Resend API Key. 
// For this frontend implementation, ensure the API key is provided securely (e.g., via environment variables).

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;

interface SendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
}

export const sendNotificationEmail = async ({ to, subject, html }: SendEmailParams) => {
    if (!RESEND_API_KEY) {
        console.warn("Resend API key is missing. Email not sent.");
        return false;
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Lazeez VORP Notifications <notifications@lazeez-vorp.com>",
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Failed to send email via Resend");
        }

        return true;
    } catch (error) {
        console.error("Resend Email Error:", error);
        toast.error("Failed to send notification email");
        return false;
    }
};
