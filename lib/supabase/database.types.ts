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
        }
        Relationships: []
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
          created_at: string
          includes: string[]
          pages: number
          product_id: string
          suitable_for: string[]
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          includes?: string[]
          pages: number
          product_id: string
          suitable_for?: string[]
          tags?: string[]
          updated_at?: string
        }
        Update: {
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
