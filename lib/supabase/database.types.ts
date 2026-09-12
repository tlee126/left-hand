export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AdminCatalogMutationOperation = "create" | "update" | "delete"
export type AdminCatalogTutorFormat =
  | "1:1 & Nhóm nhỏ (Online/Offline)"
  | "1:1 (Online/Offline quận 7)"
  | "1:1 & Nhóm nhỏ (Online)"
  | "1:1 (Online qua Google Meet)"
  | "1:1 & Nhóm nhỏ (Offline/Online)"
  | "1:1 (Online)"
  | "1:1 & Nhóm nhỏ (Online/Offline Q7)"
export type AdminCatalogTutorSubjectAssociation = { subject_id: string; is_primary: boolean }
type AdminCatalogProductFields = {
  slug?: string
  title?: string
  description?: string
  subject_id?: string
  category?: Database["public"]["Enums"]["category_enum"]
  delivery_kind?: Database["public"]["Enums"]["delivery_kind_enum"]
  publication_status?: Database["public"]["Enums"]["publication_status_enum"]
  price_vnd?: number | null
  old_price_vnd?: number | null
  is_contact_for_price?: boolean
  rating?: number
  is_hot?: boolean
  color_theme?: Database["public"]["Enums"]["color_theme_enum"]
}
export type AdminCatalogProductPayload = AdminCatalogProductFields
export type AdminCatalogCreateProductPayload = {
  slug: string
  title: string
  description: string
  subject_id: string
  category: Database["public"]["Enums"]["category_enum"]
  delivery_kind: Database["public"]["Enums"]["delivery_kind_enum"]
  publication_status?: Database["public"]["Enums"]["publication_status_enum"]
  price_vnd: number | null
  old_price_vnd: number | null
  is_contact_for_price: boolean
  rating?: number
  is_hot?: boolean
  color_theme: Database["public"]["Enums"]["color_theme_enum"]
}
export type AdminCatalogMaterialPayload = { pages?: number; tags?: string[]; includes?: string[]; suitable_for?: string[]; allow_download?: boolean }
export type AdminCatalogCreateMaterialPayload = { pages: number; tags?: string[]; includes?: string[]; suitable_for?: string[]; allow_download?: boolean }
export type AdminCatalogCoursePayload = { format?: Database["public"]["Enums"]["course_format_enum"]; sessions?: number; duration?: string; schedule?: string; enrollment_status?: Database["public"]["Enums"]["enrollment_status_enum"]; mentor?: string; tags?: string[]; curriculum?: string[]; suitable_for?: string[]; preparation?: string[] }
export type AdminCatalogCreateCoursePayload = { format: Database["public"]["Enums"]["course_format_enum"]; sessions: number; duration: string; schedule: string; enrollment_status?: Database["public"]["Enums"]["enrollment_status_enum"]; mentor: string; tags?: string[]; curriculum?: string[]; suitable_for?: string[]; preparation?: string[] }
export type AdminCatalogTutorPayload = { name?: string; faculty?: string; format?: AdminCatalogTutorFormat; availability?: string; short_bio?: string; strengths?: string[]; tags?: string[]; suitable_for?: string[]; support_methods?: string[]; subject_associations?: AdminCatalogTutorSubjectAssociation[] }
export type AdminCatalogCreateTutorPayload = { name: string; faculty: string; format: AdminCatalogTutorFormat; availability: string; short_bio: string; strengths?: string[]; tags?: string[]; suitable_for?: string[]; support_methods?: string[]; subject_associations: AdminCatalogTutorSubjectAssociation[] }
export type AdminCatalogChildPayload = AdminCatalogMaterialPayload | AdminCatalogCoursePayload | AdminCatalogTutorPayload
export type AdminCatalogMutateArgs =
  | { p_operation: "create"; p_kind: "material"; p_product: AdminCatalogCreateProductPayload; p_child: AdminCatalogCreateMaterialPayload; p_product_id?: never }
  | { p_operation: "create"; p_kind: "course"; p_product: AdminCatalogCreateProductPayload; p_child: AdminCatalogCreateCoursePayload; p_product_id?: never }
  | { p_operation: "create"; p_kind: "tutor"; p_product: AdminCatalogCreateProductPayload; p_child: AdminCatalogCreateTutorPayload; p_product_id?: never }
  | { p_operation: "update"; p_kind: "material"; p_product: AdminCatalogProductPayload; p_child: AdminCatalogMaterialPayload; p_product_id: string }
  | { p_operation: "update"; p_kind: "course"; p_product: AdminCatalogProductPayload; p_child: AdminCatalogCoursePayload; p_product_id: string }
  | { p_operation: "update"; p_kind: "tutor"; p_product: AdminCatalogProductPayload; p_child: AdminCatalogTutorPayload; p_product_id: string }
  | { p_operation: "delete"; p_kind: "material" | "course" | "tutor"; p_product: {}; p_child: {}; p_product_id: string }

export type AdminMaterialAtomicMutateArgs =
  | { p_operation: "create"; p_product: AdminCatalogCreateProductPayload; p_material: AdminCatalogCreateMaterialPayload; p_product_id?: never }
  | { p_operation: "update"; p_product: AdminCatalogProductPayload; p_material: AdminCatalogMaterialPayload; p_product_id: string }

export type ConsultationIntakeRpcArgs = {
  p_request_id: string
  p_full_name: string
  p_phone: string
  p_faculty: string
  p_major: string | null
  p_interest: string
  p_need: string
  p_note: string | null
  p_source_path: string | null
  p_selected_product_slug: string | null
  p_selected_subject_slug: string | null
}

export type SaveLearningProgressRpcArgs = {
  p_product_id: string
  p_item_type: "material" | "lesson"
  p_item_id: string
  p_status: "not_started" | "in_progress" | "completed"
  p_watched_percent: number
  p_started_at: string | null
  p_completed_at: string | null
  p_expected_version: number
}

export type AdminMaterialDirectGrantUpsertArgs = {
  p_material_id: string
  p_user_id: string
  p_can_view: boolean
  p_can_download: boolean
  p_expires_at?: string | null
}

export type AdminMaterialDirectGrantUpdateArgs = {
  p_material_id: string
  p_user_id: string
  p_can_view?: boolean | null
  p_can_download?: boolean | null
  p_expires_at?: string | null
  p_set_expires_at: boolean
}

export type AdminMaterialDirectGrantRevokeArgs = {
  p_material_id: string
  p_user_id: string
}

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      consultations: {
        Row: {
          created_at: string
          faculty: string
          full_name: string
          id: string
          interest: string
          major: string | null
          need: string
          note: string | null
          phone: string
          request_id: string
          selected_product_slug: string | null
          selected_subject_slug: string | null
          source_path: string | null
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          faculty: string
          full_name: string
          id?: string
          interest: string
          major?: string | null
          need: string
          note?: string | null
          phone: string
          request_id: string
          selected_product_slug?: string | null
          selected_subject_slug?: string | null
          source_path?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          faculty?: string
          full_name?: string
          id?: string
          interest?: string
          major?: string | null
          need?: string
          note?: string | null
          phone?: string
          request_id?: string
          selected_product_slug?: string | null
          selected_subject_slug?: string | null
          source_path?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      consultation_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          consultation_id: string
          id: string
          new_status: string
          old_status: string
          version: number
        }
        Insert: {
          changed_at?: string
          changed_by: string
          consultation_id: string
          id?: string
          new_status: string
          old_status: string
          version: number
        }
        Update: {
          changed_at?: string
          changed_by?: string
          consultation_id?: string
          id?: string
          new_status?: string
          old_status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "consultation_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedSchema: "auth"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_status_history_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          order_index: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["product_id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          curriculum: string[]
          duration: string
          enrollment_status: Database["public"]["Enums"]["enrollment_status_enum"]
          format: Database["public"]["Enums"]["course_format_enum"]
          mentor: string
          preparation: string[]
          product_id: string
          schedule: string
          sessions: number
          suitable_for: string[]
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          curriculum?: string[]
          duration: string
          enrollment_status?: Database["public"]["Enums"]["enrollment_status_enum"]
          format: Database["public"]["Enums"]["course_format_enum"]
          mentor: string
          preparation?: string[]
          product_id: string
          schedule: string
          sessions: number
          suitable_for?: string[]
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          curriculum?: string[]
          duration?: string
          enrollment_status?: Database["public"]["Enums"]["enrollment_status_enum"]
          format?: Database["public"]["Enums"]["course_format_enum"]
          mentor?: string
          preparation?: string[]
          product_id?: string
          schedule?: string
          sessions?: number
          suitable_for?: string[]
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          allow_download: boolean
          created_at: string
          includes: string[]
          pages: number
          product_id: string
          suitable_for: string[]
          tags: string[]
          updated_at: string
        }
        Insert: {
          allow_download?: boolean
          created_at?: string
          includes?: string[]
          pages: number
          product_id: string
          suitable_for?: string[]
          tags?: string[]
          updated_at?: string
        }
        Update: {
          allow_download?: boolean
          created_at?: string
          includes?: string[]
          pages?: number
          product_id?: string
          suitable_for?: string[]
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      material_assets: {
        Row: {
          byte_size: number
          created_at: string
          id: string
          mime_type: string
          original_name: string
          product_id: string
          storage_path: string
          upload_idempotency_key: string | null
          upload_reservation_id: string | null
          updated_at: string
          uploaded_by: string | null
          version: number
          visibility: string
        }
        Insert: {
          byte_size: number
          created_at?: string
          id?: string
          mime_type: string
          original_name: string
          product_id: string
          storage_path: string
          upload_idempotency_key?: string | null
          upload_reservation_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version: number
          visibility?: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          id?: string
          mime_type?: string
          original_name?: string
          product_id?: string
          storage_path?: string
          upload_idempotency_key?: string | null
          upload_reservation_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_assets_product_material_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["product_id"]
          },
        ]
      }
      material_direct_grants: {
        Row: {
          can_download: boolean
          can_view: boolean
          created_at: string
          expires_at: string | null
          granted_by: string
          id: string
          material_id: string
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          can_download?: boolean
          can_view?: boolean
          created_at?: string
          expires_at?: string | null
          granted_by: string
          id?: string
          material_id: string
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          can_download?: boolean
          can_view?: boolean
          created_at?: string
          expires_at?: string | null
          granted_by?: string
          id?: string
          material_id?: string
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_direct_grants_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "material_direct_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_asset_upload_reservations: {
        Row: {
          byte_size: number
          cancelled_at: string | null
          created_at: string
          cleanup_attempts: number
          cleanup_claim_id: string | null
          cleanup_claimed_at: string | null
          cleanup_pending_at: string | null
          expires_at: string
          id: string
          mime_type: string
          original_name: string
          product_id: string
          retryable_at: string | null
          storage_path: string
          upload_idempotency_key: string | null
          uploaded_by: string
          version: number
        }
        Insert: {
          byte_size: number
          cancelled_at?: string | null
          created_at?: string
          cleanup_attempts?: number
          cleanup_claim_id?: string | null
          cleanup_claimed_at?: string | null
          cleanup_pending_at?: string | null
          expires_at?: string
          id?: string
          mime_type: string
          original_name: string
          product_id: string
          retryable_at?: string | null
          storage_path: string
          upload_idempotency_key?: string | null
          uploaded_by: string
          version: number
        }
        Update: {
          byte_size?: number
          cancelled_at?: string | null
          created_at?: string
          cleanup_attempts?: number
          cleanup_claim_id?: string | null
          cleanup_claimed_at?: string | null
          cleanup_pending_at?: string | null
          expires_at?: string
          id?: string
          mime_type?: string
          original_name?: string
          product_id?: string
          retryable_at?: string | null
          storage_path?: string
          upload_idempotency_key?: string | null
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_asset_upload_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["product_id"]
          },
        ]
      }
      learning_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          item_id: string
          item_type: string
          product_id: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
          version: number
          watched_percent: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          item_id: string
          item_type: string
          product_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          version?: number
          watched_percent?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          item_id?: string
          item_type?: string
          product_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
          watched_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_progress_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_entitlements: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          product_id: string
          revoked_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          product_id: string
          revoked_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          product_id?: string
          revoked_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_entitlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          request_key: string
          status: string
          subject_id: string
          task_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_minutes: number
          id?: string
          request_key: string
          status?: string
          subject_id: string
          task_date: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          request_key?: string
          status?: string
          subject_id?: string
          task_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: Database["public"]["Enums"]["category_enum"]
          color_theme: Database["public"]["Enums"]["color_theme_enum"]
          created_at: string
          delivery_kind: Database["public"]["Enums"]["delivery_kind_enum"]
          description: string
          id: string
          is_contact_for_price: boolean
          is_hot: boolean
          kind: Database["public"]["Enums"]["product_kind_enum"]
          old_price_vnd: number | null
          price_vnd: number | null
          publication_status: Database["public"]["Enums"]["publication_status_enum"]
          rating: number
          search_document: string
          slug: string
          subject_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["category_enum"]
          color_theme: Database["public"]["Enums"]["color_theme_enum"]
          created_at?: string
          delivery_kind: Database["public"]["Enums"]["delivery_kind_enum"]
          description: string
          id?: string
          is_contact_for_price?: boolean
          is_hot?: boolean
          kind: Database["public"]["Enums"]["product_kind_enum"]
          old_price_vnd?: number | null
          price_vnd?: number | null
          publication_status?: Database["public"]["Enums"]["publication_status_enum"]
          rating?: number
          search_document?: string
          slug: string
          subject_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["category_enum"]
          color_theme?: Database["public"]["Enums"]["color_theme_enum"]
          created_at?: string
          delivery_kind?: Database["public"]["Enums"]["delivery_kind_enum"]
          description?: string
          id?: string
          is_contact_for_price?: boolean
          is_hot?: boolean
          kind?: Database["public"]["Enums"]["product_kind_enum"]
          old_price_vnd?: number | null
          price_vnd?: number | null
          publication_status?: Database["public"]["Enums"]["publication_status_enum"]
          rating?: number
          search_document?: string
          slug?: string
          subject_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          faculty: string | null
          full_name: string
          gpa_goal: number | null
          id: string
          major: string | null
          phone: string | null
          rejection_reason: string | null
          role: string
          student_code: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          faculty?: string | null
          full_name: string
          gpa_goal?: number | null
          id: string
          major?: string | null
          phone?: string | null
          rejection_reason?: string | null
          role?: string
          student_code?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          faculty?: string | null
          full_name?: string
          gpa_goal?: number | null
          id?: string
          major?: string | null
          phone?: string | null
          rejection_reason?: string | null
          role?: string
          student_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          category: Database["public"]["Enums"]["category_enum"]
          color_theme: Database["public"]["Enums"]["color_theme_enum"]
          created_at: string
          faculty_group: string
          id: string
          name: string
          search_document: string
          slug: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["category_enum"]
          color_theme: Database["public"]["Enums"]["color_theme_enum"]
          created_at?: string
          faculty_group: string
          id?: string
          name: string
          search_document?: string
          slug: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["category_enum"]
          color_theme?: Database["public"]["Enums"]["color_theme_enum"]
          created_at?: string
          faculty_group?: string
          id?: string
          name?: string
          search_document?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      tutor_subjects: {
        Row: {
          created_at: string
          is_primary: boolean
          subject_id: string
          tutor_product_id: string
        }
        Insert: {
          created_at?: string
          is_primary?: boolean
          subject_id: string
          tutor_product_id: string
        }
        Update: {
          created_at?: string
          is_primary?: boolean
          subject_id?: string
          tutor_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_subjects_tutor_product_id_fkey"
            columns: ["tutor_product_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["product_id"]
          },
        ]
      }
      tutors: {
        Row: {
          availability: string
          created_at: string
          faculty: string
          format: string
          name: string
          product_id: string
          short_bio: string
          strengths: string[]
          suitable_for: string[]
          support_methods: string[]
          tags: string[]
          updated_at: string
        }
        Insert: {
          availability: string
          created_at?: string
          faculty: string
          format: string
          name: string
          product_id: string
          short_bio: string
          strengths?: string[]
          suitable_for?: string[]
          support_methods?: string[]
          tags?: string[]
          updated_at?: string
        }
        Update: {
          availability?: string
          created_at?: string
          faculty?: string
          format?: string
          name?: string
          product_id?: string
          short_bio?: string
          strengths?: string[]
          suitable_for?: string[]
          support_methods?: string[]
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutors_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_catalog_read_surface: {
        Row: {
          id: string
          slug: string
          kind: Database["public"]["Enums"]["product_kind_enum"]
          title: string
          description: string
          subject_id: string
          category: Database["public"]["Enums"]["category_enum"]
          delivery_kind: Database["public"]["Enums"]["delivery_kind_enum"]
          publication_status: Database["public"]["Enums"]["publication_status_enum"]
          price_vnd: number | null
          old_price_vnd: number | null
          is_contact_for_price: boolean
          rating: number
          is_hot: boolean
          color_theme: Database["public"]["Enums"]["color_theme_enum"]
          created_at: string
          updated_at: string
          materials: Json | null
          courses: Json | null
          tutors: Json | null
        }
        Relationships: []
      }
      learner_course_read_surface: {
        Row: { product_id: string; subject_id: string; title: string; description: string }
        Relationships: []
      }
      learner_material_read_surface: {
        Row: { product_id: string; subject_id: string; title: string; description: string; pages: number; allow_download: boolean }
        Relationships: []
      }
      public_catalog_read_surface: {
        Row: {
          id: string
          slug: string
          kind: Database["public"]["Enums"]["product_kind_enum"]
          title: string
          description: string
          subject_id: string
          category: Database["public"]["Enums"]["category_enum"]
          delivery_kind: Database["public"]["Enums"]["delivery_kind_enum"]
          publication_status: Database["public"]["Enums"]["publication_status_enum"]
          price_vnd: number | null
          old_price_vnd: number | null
          is_contact_for_price: boolean
          rating: number
          is_hot: boolean
          color_theme: Database["public"]["Enums"]["color_theme_enum"]
          created_at: string
          subjects: Json
          materials: Json | null
          courses: Json | null
          tutors: Json | null
        }
        Relationships: []
      }
      student_workspace_product_read_surface: {
        Row: {
          id: string
          subject_id: string
          kind: Database["public"]["Enums"]["product_kind_enum"]
          title: string
          description: string
        }
        Relationships: []
      }
    }
    Functions: {
      admin_catalog_mutate: {
        Args: AdminCatalogMutateArgs
        Returns: Json
      }
      admin_catalog_mutate_atomic: {
        Args: AdminCatalogMutateArgs
        Returns: Json
      }
      admin_catalog_mutate_v2: {
        Args: AdminCatalogMutateArgs
        Returns: Json
      }
      admin_material_download_permission_update: {
        Args: { p_allow_download: boolean; p_material_id: string }
        Returns: boolean
      }
      admin_material_mutate_atomic: {
        Args: AdminMaterialAtomicMutateArgs
        Returns: Json
      }
      admin_material_direct_grant_upsert: {
        Args: AdminMaterialDirectGrantUpsertArgs
        Returns: Json
      }
      admin_material_direct_grant_update: {
        Args: AdminMaterialDirectGrantUpdateArgs
        Returns: Json
      }
      admin_material_direct_grant_revoke: {
        Args: AdminMaterialDirectGrantRevokeArgs
        Returns: Json
      }
      admin_subject_mutate_atomic: {
        Args: {
          p_operation: AdminCatalogMutationOperation
          p_subject?: Json
          p_subject_id?: string
        }
        Returns: Json
      }
      submit_consultation_intake: {
        Args: ConsultationIntakeRpcArgs
        Returns: Json
      }
      save_learning_progress: {
        Args: SaveLearningProgressRpcArgs
        Returns: Json
      }
      reserve_material_asset_upload: {
        Args: {
          p_idempotency_key: string
          p_product_id: string
          p_original_name: string
          p_safe_filename: string
          p_mime_type: string
          p_byte_size: number
        }
        Returns: Json
      }
      finalize_material_asset_upload: {
        Args: { p_idempotency_key: string; p_reservation_id: string }
        Returns: Json
      }
      release_material_asset_upload: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      cancel_material_asset_upload: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      mark_material_asset_upload_retryable: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      begin_material_asset_upload_retry_cleanup: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      complete_material_asset_upload_retry_cleanup: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      claim_expired_material_asset_uploads: {
        Args: { p_limit: number }
        Returns: Json
      }
      complete_expired_material_asset_upload_cleanup: {
        Args: { p_claim_id: string; p_reservation_id: string }
        Returns: boolean
      }
      release_expired_material_asset_upload_cleanup: {
        Args: { p_claim_id: string; p_reservation_id: string }
        Returns: boolean
      }
      search_public_catalog_product_ids: {
        Args: { p_kind: Database["public"]["Enums"]["product_kind_enum"]; p_search: string }
        Returns: { id: string }[]
      }
    }
    Enums: {
      category_enum:
        | "Kế toán"
        | "Kinh tế"
        | "Thống kê"
        | "Marketing"
        | "Quản trị"
        | "Tài chính"
        | "MIS"
        | "Luật"
        | "Ngoại ngữ"
      color_theme_enum:
        | "accounting"
        | "economics"
        | "statistics"
        | "marketing"
        | "management"
        | "finance"
        | "law"
        | "mis"
        | "languages"
      course_format_enum: "online" | "offline" | "video" | "zoom"
      delivery_kind_enum:
        | "digital_download"
        | "live_session"
        | "recorded_video"
        | "one_on_one_tutoring"
      enrollment_status_enum: "open" | "coming-soon" | "full"
      product_kind_enum: "material" | "course" | "tutor"
      publication_status_enum: "draft" | "published" | "archived"
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
      category_enum: [
        "Kế toán",
        "Kinh tế",
        "Thống kê",
        "Marketing",
        "Quản trị",
        "Tài chính",
        "MIS",
        "Luật",
        "Ngoại ngữ",
      ],
      color_theme_enum: [
        "accounting",
        "economics",
        "statistics",
        "marketing",
        "management",
        "finance",
        "law",
        "mis",
        "languages",
      ],
      course_format_enum: ["online", "offline", "video", "zoom"],
      delivery_kind_enum: [
        "digital_download",
        "live_session",
        "recorded_video",
        "one_on_one_tutoring",
      ],
      enrollment_status_enum: ["open", "coming-soon", "full"],
      product_kind_enum: ["material", "course", "tutor"],
      publication_status_enum: ["draft", "published", "archived"],
    },
  },
} as const
