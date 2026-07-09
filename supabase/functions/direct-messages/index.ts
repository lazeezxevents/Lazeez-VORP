import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentUserId = user.id;

    // Handle GET request - List conversations
    if (req.method === "GET") {
      return await getConversations(supabase, currentUserId);
    }

    // Handle POST request - Create conversation
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      return await createConversation(supabase, currentUserId, body);
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Direct messages error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

// GET /api/direct-messages - List all conversations for current user
async function getConversations(supabase: any, currentUserId: string): Promise<Response> {
  try {
    // Fetch all direct messages where current user is a participant
    const { data: conversations, error: conversationsError } = await supabase
      .from("direct_messages")
      .select(`
        id,
        user1_id,
        user2_id,
        created_at
      `)
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);

    if (conversationsError) throw conversationsError;

    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({ conversations: [] }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get all participant IDs (excluding current user)
    const participantIds = conversations.map((conv: any) => 
      conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id
    );

    // Fetch user profiles for all participants
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, department, designation_id")
      .in("id", participantIds);

    if (profilesError) throw profilesError;

    // Fetch designations
    const { data: designations } = await supabase
      .from("designations")
      .select("id, name")
      .in("id", profiles?.map((p: any) => p.designation_id).filter(Boolean) || []);

    // Fetch presence for all participants
    const { data: presences } = await supabase
      .from("user_presence")
      .select("user_id, status, custom_status, last_seen")
      .in("user_id", participantIds);

    // Fetch last message and unread count for each conversation
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv: any) => {
        const otherUserId = conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id;
        const profile = profiles?.find((p: any) => p.id === otherUserId);
        const presence = presences?.find((p: any) => p.user_id === otherUserId);
        const designation = designations?.find((d: any) => d.id === profile?.designation_id);

        // Get last message
        const { data: lastMessageData } = await supabase
          .from("dm_messages")
          .select("id, content, created_at, user_id, deleted_at")
          .eq("direct_message_id", conv.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get unread count (messages from other user)
        const { count: unreadCount } = await supabase
          .from("dm_messages")
          .select("*", { count: "exact", head: true })
          .eq("direct_message_id", conv.id)
          .neq("user_id", currentUserId)
          .is("deleted_at", null);

        const lastMessage = lastMessageData ? {
          id: lastMessageData.id,
          content: lastMessageData.deleted_at 
            ? "Message deleted" 
            : lastMessageData.content.substring(0, 100) + (lastMessageData.content.length > 100 ? "..." : ""),
          created_at: lastMessageData.created_at,
          is_read: false,
          sender_id: lastMessageData.user_id,
        } : undefined;

        return {
          id: conv.id,
          other_user: {
            id: otherUserId,
            full_name: profile?.full_name || "Unknown User",
            profile_picture_url: profile?.avatar_url,
            email: profile?.email,
            designation: designation?.name,
            presence: {
              status: presence?.status || "offline",
              custom_status: presence?.custom_status || null,
              last_seen: presence?.last_seen,
            },
          },
          last_message: lastMessage,
          unread_count: unreadCount || 0,
          created_at: conv.created_at,
        };
      })
    );

    // Sort by last message date (most recent first)
    const sortedConversations = conversationsWithDetails.sort((a: any, b: any) => {
      const dateA = a.last_message?.created_at || a.created_at;
      const dateB = b.last_message?.created_at || b.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return new Response(
      JSON.stringify({ conversations: sortedConversations }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error fetching conversations:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to fetch conversations" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}

// POST /api/direct-messages - Create a new conversation
async function createConversation(supabase: any, currentUserId: string, body: any): Promise<Response> {
  try {
    const { recipient_id } = body;

    if (!recipient_id) {
      return new Response(
        JSON.stringify({ error: "recipient_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (recipient_id === currentUserId) {
      return new Response(
        JSON.stringify({ error: "Cannot create conversation with yourself" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Ensure consistent ordering (user1_id < user2_id)
    const user1Id = currentUserId < recipient_id ? currentUserId : recipient_id;
    const user2Id = currentUserId < recipient_id ? recipient_id : currentUserId;

    // Check if conversation already exists
    const { data: existing, error: existingError } = await supabase
      .from("direct_messages")
      .select("id, user1_id, user2_id, created_at")
      .eq("user1_id", user1Id)
      .eq("user2_id", user2Id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      // Return existing conversation with other user details
      const otherUserId = existing.user1_id === currentUserId ? existing.user2_id : existing.user1_id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("id", otherUserId)
        .single();

      return new Response(
        JSON.stringify({
          id: existing.id,
          other_user: profile || { id: otherUserId, full_name: "Unknown User" },
          created_at: existing.created_at,
          existing: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create new conversation
    const { data: newConversation, error: createError } = await supabase
      .from("direct_messages")
      .insert({
        user1_id: user1Id,
        user2_id: user2Id,
      })
      .select("id, user1_id, user2_id, created_at")
      .single();

    if (createError) throw createError;

    // Get other user profile
    const otherUserId = newConversation.user1_id === currentUserId ? newConversation.user2_id : newConversation.user1_id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("id", otherUserId)
      .single();

    return new Response(
      JSON.stringify({
        id: newConversation.id,
        other_user: profile || { id: otherUserId, full_name: "Unknown User" },
        created_at: newConversation.created_at,
        existing: false,
      }),
      { status: 201, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error creating conversation:", error);
    
    // Handle unique constraint violation
    if (error.message?.includes("duplicate") || error.code === "23505") {
      return new Response(
        JSON.stringify({ error: "Conversation already exists" }),
        { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: error.message || "Failed to create conversation" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}

serve(handler);
