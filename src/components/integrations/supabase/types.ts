export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          entityId: string
          entityType: string
          id: string
          metadata: Json | null
          newValues: Json | null
          oldValues: Json | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          entityId: string
          entityType: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      designations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      employee_vendor_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          employee_id: string
          id: string
          vendor_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          employee_id: string
          id?: string
          vendor_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          employee_id?: string
          id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_vendor_assignments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_activity: {
        Row: {
          id: string
          issue_id: string
          user_id: string | null
          action_type: string
          old_value: string | null
          new_value: string | null
          comment_text: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          issue_id: string
          user_id?: string | null
          action_type: string
          old_value?: string | null
          new_value?: string | null
          comment_text?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          issue_id?: string
          user_id?: string | null
          action_type?: string
          old_value?: string | null
          new_value?: string | null
          comment_text?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_activity_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_attachments: {
        Row: {
          id: string
          issue_id: string
          file_name: string
          file_url: string
          file_type: string
          file_size: number
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          issue_id: string
          file_name: string
          file_url: string
          file_type: string
          file_size: number
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          issue_id?: string
          file_name?: string
          file_url?: string
          file_type?: string
          file_size?: number
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_attachments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_labels: {
        Row: {
          id: string
          name: string
          color: string
          description: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color?: string
          description?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          description?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      issue_label_relations: {
        Row: {
          id: string
          issue_id: string
          label_id: string
          created_at: string
        }
        Insert: {
          id?: string
          issue_id: string
          label_id: string
          created_at?: string
        }
        Update: {
          id?: string
          issue_id?: string
          label_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_label_relations_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_label_relations_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "issue_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_time_logs: {
        Row: {
          id: string
          issue_id: string
          user_id: string
          hours: number
          description: string | null
          logged_date: string
          created_at: string
        }
        Insert: {
          id?: string
          issue_id: string
          user_id: string
          hours: number
          description?: string | null
          logged_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          issue_id?: string
          user_id?: string
          hours?: number
          description?: string | null
          logged_date?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_time_logs_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_templates: {
        Row: {
          id: string
          name: string
          title_template: string
          description_template: string | null
          default_priority: Database["public"]["Enums"]["issue_priority"]
          default_labels: string[] | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          title_template: string
          description_template?: string | null
          default_priority?: Database["public"]["Enums"]["issue_priority"]
          default_labels?: string[] | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          title_template?: string
          description_template?: string | null
          default_priority?: Database["public"]["Enums"]["issue_priority"]
          default_labels?: string[] | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      issue_watchers: {
        Row: {
          id: string
          issue_id: string
          user_id: string
          added_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          issue_id: string
          user_id: string
          added_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          issue_id?: string
          user_id?: string
          added_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_watchers_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          issue_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          issue_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          issue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["issue_priority"]
          reported_by: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["issue_priority"]
          reported_by: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["issue_priority"]
          reported_by?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      mou_vault: {
        Row: {
          created_at: string
          document_name: string
          document_type: Database["public"]["Enums"]["mou_document_type"]
          document_url: string
          effective_end_date: string | null
          effective_start_date: string | null
          extracted_terms: Json | null
          extraction_confidence: number | null
          extraction_status: Database["public"]["Enums"]["mou_extraction_status"]
          has_auto_renewal: boolean | null
          id: string
          last_renewal_date: string | null
          mou_id: string | null
          mou_purpose: string | null
          party_1_business: string | null
          party_1_name: string | null
          party_2_business: string | null
          party_2_name: string | null
          renewal_count: number | null
          renewal_period_days: number | null
          signed_date: string | null
          termination_deadline: string | null
          termination_notice_days: number | null
          updated_at: string
          uploaded_by: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type?: Database["public"]["Enums"]["mou_document_type"]
          document_url: string
          effective_end_date?: string | null
          effective_start_date?: string | null
          extracted_terms?: Json | null
          extraction_confidence?: number | null
          extraction_status?: Database["public"]["Enums"]["mou_extraction_status"]
          has_auto_renewal?: boolean | null
          id?: string
          last_renewal_date?: string | null
          mou_id?: string | null
          mou_purpose?: string | null
          party_1_business?: string | null
          party_1_name?: string | null
          party_2_business?: string | null
          party_2_name?: string | null
          renewal_count?: number | null
          renewal_period_days?: number | null
          signed_date?: string | null
          termination_deadline?: string | null
          termination_notice_days?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: Database["public"]["Enums"]["mou_document_type"]
          document_url?: string
          effective_end_date?: string | null
          effective_start_date?: string | null
          extracted_terms?: Json | null
          extraction_confidence?: number | null
          extraction_status?: Database["public"]["Enums"]["mou_extraction_status"]
          has_auto_renewal?: boolean | null
          id?: string
          last_renewal_date?: string | null
          mou_id?: string | null
          mou_purpose?: string | null
          party_1_business?: string | null
          party_1_name?: string | null
          party_2_business?: string | null
          party_2_name?: string | null
          renewal_count?: number | null
          renewal_period_days?: number | null
          signed_date?: string | null
          termination_deadline?: string | null
          termination_notice_days?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mou_vault_mou_id_fkey"
            columns: ["mou_id"]
            isOneToOne: false
            referencedRelation: "mous"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mou_vault_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      mou_vault_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          document_url: string | null
          id: string
          notes: string | null
          revision_date: string
          revision_type: Database["public"]["Enums"]["mou_revision_type"]
          vault_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          revision_date?: string
          revision_type: Database["public"]["Enums"]["mou_revision_type"]
          vault_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          revision_date?: string
          revision_type?: Database["public"]["Enums"]["mou_revision_type"]
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mou_vault_revisions_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "mou_vault"
            referencedColumns: ["id"]
          },
        ]
      }
      mou_versions: {
        Row: {
          change_summary: string | null
          change_type: string
          changed_by: string | null
          created_at: string
          document_url: string | null
          end_date: string | null
          id: string
          mou_id: string
          start_date: string | null
          status: string
          terms: string | null
          title: string
          vendor_id: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          change_type: string
          changed_by?: string | null
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          id?: string
          mou_id: string
          start_date?: string | null
          status: string
          terms?: string | null
          title: string
          vendor_id: string
          version_number?: number
        }
        Update: {
          change_summary?: string | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          id?: string
          mou_id?: string
          start_date?: string | null
          status?: string
          terms?: string | null
          title?: string
          vendor_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "mou_versions_mou_id_fkey"
            columns: ["mou_id"]
            isOneToOne: false
            referencedRelation: "mous"
            referencedColumns: ["id"]
          },
        ]
      }
      mous: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          document_url: string | null
          end_date: string | null
          id: string
          start_date: string | null
          status: Database["public"]["Enums"]["mou_status"]
          terms: string | null
          title: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["mou_status"]
          terms?: string | null
          title: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["mou_status"]
          terms?: string | null
          title?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mous_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          issue_assignments: boolean
          issue_updates: boolean
          mou_expiration_days: number[]
          mou_expiration_reminders: boolean
          mou_status_changes: boolean
          updated_at: string
          user_id: string
          weekly_digest: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          issue_assignments?: boolean
          issue_updates?: boolean
          mou_expiration_days?: number[]
          mou_expiration_reminders?: boolean
          mou_status_changes?: boolean
          updated_at?: string
          user_id: string
          weekly_digest?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          issue_assignments?: boolean
          issue_updates?: boolean
          mou_expiration_days?: number[]
          mou_expiration_reminders?: boolean
          mou_status_changes?: boolean
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          id: string
          call_session_id: string
          user_id: string
          joined_at: string
          left_at: string | null
        }
        Insert: {
          id?: string
          call_session_id: string
          user_id: string
          joined_at?: string
          left_at?: string | null
        }
        Update: {
          call_session_id?: string
          user_id?: string
          joined_at?: string
          left_at?: string | null
        }
        Relationships: []
      }
      call_sessions: {
        Row: {
          id: string
          channel_id: string | null
          call_type: string
          started_at: string
          ended_at: string | null
          recording_url: string | null
          transcript_url: string | null
          initiated_by: string | null
        }
        Insert: {
          id?: string
          channel_id?: string | null
          call_type: string
          started_at?: string
          ended_at?: string | null
          recording_url?: string | null
          transcript_url?: string | null
          initiated_by?: string | null
        }
        Update: {
          channel_id?: string | null
          call_type?: string
          started_at?: string
          ended_at?: string | null
          recording_url?: string | null
          transcript_url?: string | null
          initiated_by?: string | null
        }
        Relationships: []
      }
      channel_members: {
        Row: {
          id: string
          channel_id: string
          user_id: string
          joined_at: string
          role: string
          last_read_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          user_id: string
          joined_at?: string
          role?: string
          last_read_at?: string
        }
        Update: {
          channel_id?: string
          user_id?: string
          joined_at?: string
          role?: string
          last_read_at?: string
        }
        Relationships: []
      }
      channels: {
        Row: {
          id: string
          department_id: string
          name: string
          description: string | null
          purpose: string | null
          is_private: boolean
          is_archived: boolean
          created_at: string
        }
        Insert: {
          id?: string
          department_id: string
          name: string
          description?: string | null
          purpose?: string | null
          is_private?: boolean
          is_archived?: boolean
          created_at?: string
        }
        Update: {
          department_id?: string
          name?: string
          description?: string | null
          purpose?: string | null
          is_private?: boolean
          is_archived?: boolean
          created_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          id: string
          user1_id: string
          user2_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user1_id: string
          user2_id: string
          created_at?: string
        }
        Update: {
          user1_id?: string
          user2_id?: string
          created_at?: string
        }
        Relationships: []
      }
      dm_message_attachments: {
        Row: {
          id: string
          dm_message_id: string
          file_url: string
          file_name: string
          file_size: number
          file_type: string
          thumbnail_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          dm_message_id: string
          file_url: string
          file_name: string
          file_size: number
          file_type: string
          thumbnail_url?: string | null
          created_at?: string
        }
        Update: {
          dm_message_id?: string
          file_url?: string
          file_name?: string
          file_size?: number
          file_type?: string
          thumbnail_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      dm_message_reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
        Relationships: []
      }
      dm_messages: {
        Row: {
          id: string
          direct_message_id: string
          user_id: string
          content: string
          edited_at: string | null
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          direct_message_id: string
          user_id: string
          content: string
          edited_at?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          direct_message_id?: string
          user_id?: string
          content?: string
          edited_at?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          id: string
          message_id: string
          file_url: string
          file_name: string
          file_size: number
          file_type: string
          thumbnail_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          file_url: string
          file_name: string
          file_size: number
          file_type: string
          thumbnail_url?: string | null
          created_at?: string
        }
        Update: {
          message_id?: string
          file_url?: string
          file_name?: string
          file_size?: number
          file_type?: string
          thumbnail_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      message_bookmarks: {
        Row: {
          id: string
          user_id: string
          message_id: string
          note: string | null
          tags: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message_id: string
          note?: string | null
          tags?: string[] | null
          created_at?: string
        }
        Update: {
          user_id?: string
          message_id?: string
          note?: string | null
          tags?: string[] | null
          created_at?: string
        }
        Relationships: []
      }
      message_polls: {
        Row: {
          id: string
          message_id: string
          question: string
          options: Json
          allow_multiple: boolean
          anonymous: boolean
          expires_at: string | null
          closed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          question: string
          options: Json
          allow_multiple?: boolean
          anonymous?: boolean
          expires_at?: string | null
          closed_at?: string | null
          created_at?: string
        }
        Update: {
          message_id?: string
          question?: string
          options?: Json
          allow_multiple?: boolean
          anonymous?: boolean
          expires_at?: string | null
          closed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
        Relationships: []
      }
      message_reminders: {
        Row: {
          id: string
          user_id: string
          message_id: string
          remind_at: string
          is_recurring: boolean
          recurrence_pattern: string | null
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message_id: string
          remind_at: string
          is_recurring?: boolean
          recurrence_pattern?: string | null
          completed?: boolean
          created_at?: string
        }
        Update: {
          user_id?: string
          message_id?: string
          remind_at?: string
          is_recurring?: boolean
          recurrence_pattern?: string | null
          completed?: boolean
          created_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          channel_id: string
          thread_parent_id: string | null
          user_id: string
          content: string
          edited_at: string | null
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          thread_parent_id?: string | null
          user_id: string
          content: string
          edited_at?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          channel_id?: string
          thread_parent_id?: string | null
          user_id?: string
          content?: string
          edited_at?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      pinned_messages: {
        Row: {
          id: string
          channel_id: string
          message_id: string
          pinned_by: string
          pinned_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          message_id: string
          pinned_by: string
          pinned_at?: string
        }
        Update: {
          channel_id?: string
          message_id?: string
          pinned_by?: string
          pinned_at?: string
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string | null
          status: string
          priority: string
          assigned_to: string | null
          created_by: string | null
          due_date: string | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          description?: string | null
          status?: string
          priority?: string
          assigned_to?: string | null
          created_by?: string | null
          due_date?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          project_id?: string
          title?: string
          description?: string | null
          status?: string
          priority?: string
          assigned_to?: string | null
          created_by?: string | null
          due_date?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          status: string
          vendor_id: string | null
          created_by: string | null
          manager_id: string | null
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          status?: string
          vendor_id?: string | null
          created_by?: string | null
          manager_id?: string | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          status?: string
          vendor_id?: string | null
          created_by?: string | null
          manager_id?: string | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_communication_preferences: {
        Row: {
          user_id: string
          department_order: Json
          enable_department_reordering: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          department_order?: Json
          enable_department_reordering?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          department_order?: Json
          enable_department_reordering?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          created_at: string
          digest_frequency: string
          email_digests: boolean
          notification_sounds: boolean
          push_notifications: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          sound_volume_percent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_frequency?: string
          email_digests?: boolean
          notification_sounds?: boolean
          push_notifications?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          sound_volume_percent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_frequency?: string
          email_digests?: boolean
          notification_sounds?: boolean
          push_notifications?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          sound_volume_percent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          user_id: string
          status: string
          custom_status: string | null
          status_expires_at: string | null
          last_seen: string
          updated_at: string
        }
        Insert: {
          user_id: string
          status?: string
          custom_status?: string | null
          status_expires_at?: string | null
          last_seen?: string
          updated_at?: string
        }
        Update: {
          status?: string
          custom_status?: string | null
          status_expires_at?: string | null
          last_seen?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          designation_id: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          designation_id?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          designation_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      app_permissions: {
        Row: {
          id: string
          name: string
          slug: string
          module: string
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          module: string
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          module?: string
          description?: string
          created_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          role_id: string
          permission_id: string
          created_at: string
        }
        Insert: {
          role_id: string
          permission_id: string
          created_at?: string
        }
        Update: {
          role_id?: string
          permission_id?: string
          created_at?: string
        }
        Relationships: []
      }
      vendor_documents: {
        Row: {
          created_at: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          name: string
          uploaded_by: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          uploaded_by?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          uploaded_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payments: {
        Row: {
          commission_amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_amount: number
          order_id: string
          payment_status: string
          remaining_amount: number
          remaining_released_at: string | null
          updated_at: string
          upfront_amount: number
          upfront_paid_at: string | null
          upfront_percentage: number
          vendor_id: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_amount?: number
          order_id: string
          payment_status?: string
          remaining_amount?: number
          remaining_released_at?: string | null
          updated_at?: string
          upfront_amount?: number
          upfront_paid_at?: string | null
          upfront_percentage?: number
          vendor_id: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_amount?: number
          order_id?: string
          payment_status?: string
          remaining_amount?: number
          remaining_released_at?: string | null
          updated_at?: string
          upfront_amount?: number
          upfront_paid_at?: string | null
          upfront_percentage?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_remarks: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          remark: string
          remark_type: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          remark: string
          remark_type?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          remark?: string
          remark_type?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_remarks_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_name: string | null
          bank_title: string | null
          category: Database["public"]["Enums"]["vendor_category"]
          city: string | null
          commission_percentage: number | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          description: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          owner_cnic: string | null
          owner_name: string | null
          phone: string | null
          rating: number | null
          safiac_score: number | null
          status: Database["public"]["Enums"]["vendor_status"]
          sticker_status: string | null
          subscription_after_orders: number | null
          subscription_amount: number | null
          subscription_threshold: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          bank_title?: string | null
          category?: Database["public"]["Enums"]["vendor_category"]
          city?: string | null
          commission_percentage?: number | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          owner_cnic?: string | null
          owner_name?: string | null
          phone?: string | null
          rating?: number | null
          safiac_score?: number | null
          status?: Database["public"]["Enums"]["vendor_status"]
          sticker_status?: string | null
          subscription_after_orders?: number | null
          subscription_amount?: number | null
          subscription_threshold?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          bank_title?: string | null
          category?: Database["public"]["Enums"]["vendor_category"]
          city?: string | null
          commission_percentage?: number | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          owner_cnic?: string | null
          owner_name?: string | null
          phone?: string | null
          rating?: number | null
          safiac_score?: number | null
          status?: Database["public"]["Enums"]["vendor_status"]
          sticker_status?: string | null
          subscription_after_orders?: number | null
          subscription_amount?: number | null
          subscription_threshold?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      mark_channel_read: {
        Args: { p_channel_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "ops_manager" | "employee"
      issue_priority: "critical" | "high" | "medium" | "low"
      issue_status: "open" | "in_progress" | "resolved" | "closed"
      mou_document_type: "new" | "legacy"
      mou_extraction_status: "pending" | "processing" | "completed" | "failed"
      mou_revision_type: "amendment" | "renewal" | "termination"
      mou_status:
      | "draft"
      | "pending_review"
      | "approved"
      | "signed"
      | "expired"
      | "terminated"
      | "legacy"
      vendor_category:
      | "catering"
      | "decoration"
      | "photography"
      | "entertainment"
      | "venue"
      | "logistics"
      | "other"
      | "home_chef"
      | "home_baker"
      | "bakery"
      | "restaurant"
      vendor_status:
      | "onboarded"
      | "terminated"
      | "left"
      | "pending"
      | "new"
      | "active"
      | "inactive"
      | "blacklisted"
      | "legacy"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "ops_manager", "employee"],
      issue_priority: ["critical", "high", "medium", "low"],
      issue_status: ["open", "in_progress", "resolved", "closed"],
      mou_document_type: ["new", "legacy"],
      mou_extraction_status: ["pending", "processing", "completed", "failed"],
      mou_revision_type: ["amendment", "renewal", "termination"],
      mou_status: [
        "draft",
        "pending_review",
        "approved",
        "signed",
        "expired",
        "terminated",
        "legacy",
      ],
      vendor_category: [
        "catering",
        "decoration",
        "photography",
        "entertainment",
        "venue",
        "logistics",
        "other",
        "home_chef",
        "home_baker",
        "bakery",
        "restaurant",
      ],
      vendor_status: [
        "onboarded",
        "terminated",
        "left",
        "pending",
        "new",
        "active",
        "inactive",
        "blacklisted",
        "legacy",
      ],
    },
  },
} as const
