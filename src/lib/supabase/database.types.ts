// ─────────────────────────────────────────────────────────────────────────────
// ARQUIVO GERADO. NÃO EDITE À MÃO.
//
//   pnpm db:types
//
// A fonte é o schema, e o schema é `supabase/migrations/`. Editar aqui não
// muda o banco: só faz o TypeScript mentir sobre ele. Mudou uma tabela?
// Migration nova, `pnpm db:reset`, `pnpm db:types`, e commite este arquivo
// junto (.claude/rules/database.md).
//
// Gerado a partir do staging (`boop-os-staging`, sa-east-1), cujo schema é
// idêntico ao local — conferido por `scripts/db/fingerprint.sql`.
//
// Fora do `format:check` de propósito: é saída de ferramenta, e reformatá-la
// só criaria diff a cada regeração (ver .prettierignore).
// ─────────────────────────────────────────────────────────────────────────────

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          client_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
          project_id: string | null
          request_id: string | null
          visibility: Database["public"]["Enums"]["activity_visibility"]
        }
        Insert: {
          action: string
          actor_id?: string | null
          client_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
          project_id?: string | null
          request_id?: string | null
          visibility?: Database["public"]["Enums"]["activity_visibility"]
        }
        Update: {
          action?: string
          actor_id?: string | null
          client_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
          project_id?: string | null
          request_id?: string | null
          visibility?: Database["public"]["Enums"]["activity_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_memberships: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_memberships_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_memberships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          slug: string
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          slug: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_approvals: {
        Row: {
          client_id: string
          content_version_id: string
          created_at: string
          decided_by: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          note: string | null
        }
        Insert: {
          client_id: string
          content_version_id: string
          created_at?: string
          decided_by?: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          id?: string
          note?: string | null
        }
        Update: {
          client_id?: string
          content_version_id?: string
          created_at?: string
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_approvals_content_version_id_fkey"
            columns: ["content_version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_comments: {
        Row: {
          author_id: string | null
          body: string
          client_id: string
          content_item_id: string
          content_version_id: string | null
          created_at: string
          id: string
          is_internal: boolean
        }
        Insert: {
          author_id?: string | null
          body: string
          client_id: string
          content_item_id: string
          content_version_id?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
        }
        Update: {
          author_id?: string | null
          body?: string
          client_id?: string
          content_item_id?: string
          content_version_id?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "content_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_comments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_comments_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_comments_content_version_id_fkey"
            columns: ["content_version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          channel: Database["public"]["Enums"]["content_channel"]
          client_id: string
          created_at: string
          created_by: string | null
          current_version_id: string | null
          editorial_territory: string | null
          format: Database["public"]["Enums"]["content_format"]
          id: string
          objective: string | null
          project_id: string
          published_at: string | null
          published_url: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["content_channel"]
          client_id: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          editorial_territory?: string | null
          format?: Database["public"]["Enums"]["content_format"]
          id?: string
          objective?: string | null
          project_id: string
          published_at?: string | null
          published_url?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["content_channel"]
          client_id?: string
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          editorial_territory?: string | null
          format?: Database["public"]["Enums"]["content_format"]
          id?: string
          objective?: string | null
          project_id?: string
          published_at?: string | null
          published_url?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_current_version_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "content_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_versions: {
        Row: {
          approved_at: string | null
          caption: string | null
          client_id: string
          content_item_id: string
          created_at: string
          created_by: string | null
          cta: string | null
          hook: string | null
          id: string
          internal_notes: string | null
          sent_for_approval_at: string | null
          status: Database["public"]["Enums"]["content_version_status"]
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          caption?: string | null
          client_id: string
          content_item_id: string
          created_at?: string
          created_by?: string | null
          cta?: string | null
          hook?: string | null
          id?: string
          internal_notes?: string | null
          sent_for_approval_at?: string | null
          status?: Database["public"]["Enums"]["content_version_status"]
          updated_at?: string
          version: number
        }
        Update: {
          approved_at?: string | null
          caption?: string | null
          client_id?: string
          content_item_id?: string
          created_at?: string
          created_by?: string | null
          cta?: string | null
          hook?: string | null
          id?: string
          internal_notes?: string | null
          sent_for_approval_at?: string | null
          status?: Database["public"]["Enums"]["content_version_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_versions_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          client_id: string | null
          created_at: string
          dedupe_key: string | null
          error: string | null
          id: string
          payload: Json
          project_id: string | null
          provider_message_id: string | null
          recipient_email: string
          recipient_user_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          payload?: Json
          project_id?: string | null
          provider_message_id?: string | null
          recipient_email: string
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          payload?: Json
          project_id?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          recipient_user_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_answers: {
        Row: {
          created_at: string
          id: string
          question_id: string
          submission_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          submission_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          submission_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "onboarding_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "onboarding_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_questions: {
        Row: {
          created_at: string
          help_text: string | null
          id: string
          is_required: boolean
          key: string
          label: string
          options: Json | null
          position: number
          section_id: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          created_at?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          key: string
          label: string
          options?: Json | null
          position: number
          section_id: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          created_at?: string
          help_text?: string | null
          id?: string
          is_required?: boolean
          key?: string
          label?: string
          options?: Json | null
          position?: number
          section_id?: string
          type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "onboarding_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_sections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          position: number
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          position: number
          template_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          position?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_submissions: {
        Row: {
          client_id: string
          created_at: string
          id: string
          project_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["onboarding_status"]
          submitted_at: string | null
          submitted_by: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          project_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["onboarding_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          project_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["onboarding_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          name: string
          project_type: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          project_type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_at: string | null
          last_seen_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          invited_at?: string | null
          last_seen_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_at?: string | null
          last_seen_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      project_stages: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          label: string
          position: number
          project_id: string
          stage_key: string
          started_at: string | null
          state: Database["public"]["Enums"]["stage_state"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          label: string
          position: number
          project_id: string
          stage_key: string
          started_at?: string | null
          state?: Database["public"]["Enums"]["stage_state"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          label?: string
          position?: number
          project_id?: string
          stage_key?: string
          started_at?: string | null
          state?: Database["public"]["Enums"]["stage_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          cycle: number
          ends_on: string | null
          id: string
          journey_key: string
          name: string
          starts_on: string | null
          status: Database["public"]["Enums"]["project_status"]
          type: Database["public"]["Enums"]["project_type"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          cycle?: number
          ends_on?: string | null
          id?: string
          journey_key: string
          name: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          type: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          cycle?: number
          ends_on?: string | null
          id?: string
          journey_key?: string
          name?: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strategies: {
        Row: {
          client_id: string
          created_at: string
          current_version_id: string | null
          id: string
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          current_version_id?: string | null
          id?: string
          project_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          current_version_id?: string | null
          id?: string
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategies_current_version_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "strategy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_approvals: {
        Row: {
          client_id: string
          created_at: string
          decided_by: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          note: string | null
          strategy_version_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          decided_by?: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          id?: string
          note?: string | null
          strategy_version_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          note?: string | null
          strategy_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_approvals_strategy_version_id_fkey"
            columns: ["strategy_version_id"]
            isOneToOne: false
            referencedRelation: "strategy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_versions: {
        Row: {
          approved_at: string | null
          client_id: string
          content: Json
          created_at: string
          created_by: string | null
          id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["strategy_version_status"]
          strategy_id: string
          summary: string | null
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          client_id: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["strategy_version_status"]
          strategy_id: string
          summary?: string | null
          updated_at?: string
          version: number
        }
        Update: {
          approved_at?: string | null
          client_id?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["strategy_version_status"]
          strategy_id?: string
          summary?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategy_versions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_versions_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_project_stage: { Args: { p_project_id: string }; Returns: string }
      assign_invited_profile_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_user_id: string
        }
        Returns: string
      }
      create_project_with_journey: {
        Args: {
          p_client_id: string
          p_journey_key: string
          p_name: string
          p_stages: Json
          p_starts_on?: string
          p_type: Database["public"]["Enums"]["project_type"]
        }
        Returns: string
      }
      disable_profile: { Args: { p_user_id: string }; Returns: string }
      list_client_team: {
        Args: { p_client_id: string }
        Returns: {
          full_name: string
        }[]
      }
      promote_invited_profile: { Args: never; Returns: string }
      record_activity: {
        Args: {
          p_action: string
          p_client_id?: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Json
          p_project_id?: string
          p_visibility?: Database["public"]["Enums"]["activity_visibility"]
        }
        Returns: undefined
      }
      set_project_stage_state: {
        Args: {
          p_project_id: string
          p_stage_id: string
          p_state: Database["public"]["Enums"]["stage_state"]
        }
        Returns: string
      }
    }
    Enums: {
      activity_visibility: "internal" | "client"
      approval_decision: "approved" | "changes_requested"
      client_status: "active" | "paused" | "archived"
      content_channel:
        | "instagram"
        | "linkedin"
        | "tiktok"
        | "youtube"
        | "blog"
        | "other"
      content_format:
        | "reel"
        | "carousel"
        | "static"
        | "story"
        | "video"
        | "article"
        | "other"
      content_status:
        | "idea"
        | "planned"
        | "in_production"
        | "internal_review"
        | "awaiting_client"
        | "changes_requested"
        | "approved"
        | "scheduled"
        | "published"
        | "archived"
      content_version_status:
        | "draft"
        | "awaiting_client"
        | "changes_requested"
        | "approved"
        | "superseded"
      notification_status: "pending" | "sent" | "failed"
      onboarding_status: "draft" | "submitted"
      profile_status: "invited" | "active" | "disabled"
      project_status: "draft" | "active" | "paused" | "completed" | "archived"
      project_type: "social" | "website" | "branding" | "automation" | "custom"
      question_type:
        | "short_text"
        | "long_text"
        | "single_select"
        | "multi_select"
        | "boolean"
        | "number"
        | "url"
        | "file"
      stage_state: "pending" | "current" | "done" | "skipped"
      strategy_version_status:
        | "draft"
        | "awaiting_client"
        | "changes_requested"
        | "approved"
        | "superseded"
      user_role: "boop_admin" | "boop_member" | "client_user"
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
      activity_visibility: ["internal", "client"],
      approval_decision: ["approved", "changes_requested"],
      client_status: ["active", "paused", "archived"],
      content_channel: [
        "instagram",
        "linkedin",
        "tiktok",
        "youtube",
        "blog",
        "other",
      ],
      content_format: [
        "reel",
        "carousel",
        "static",
        "story",
        "video",
        "article",
        "other",
      ],
      content_status: [
        "idea",
        "planned",
        "in_production",
        "internal_review",
        "awaiting_client",
        "changes_requested",
        "approved",
        "scheduled",
        "published",
        "archived",
      ],
      content_version_status: [
        "draft",
        "awaiting_client",
        "changes_requested",
        "approved",
        "superseded",
      ],
      notification_status: ["pending", "sent", "failed"],
      onboarding_status: ["draft", "submitted"],
      profile_status: ["invited", "active", "disabled"],
      project_status: ["draft", "active", "paused", "completed", "archived"],
      project_type: ["social", "website", "branding", "automation", "custom"],
      question_type: [
        "short_text",
        "long_text",
        "single_select",
        "multi_select",
        "boolean",
        "number",
        "url",
        "file",
      ],
      stage_state: ["pending", "current", "done", "skipped"],
      strategy_version_status: [
        "draft",
        "awaiting_client",
        "changes_requested",
        "approved",
        "superseded",
      ],
      user_role: ["boop_admin", "boop_member", "client_user"],
    },
  },
} as const
