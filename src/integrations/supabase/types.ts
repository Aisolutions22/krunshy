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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      account_closings: {
        Row: {
          amount_settled: number
          closed_at: string
          closed_by: string
          customer_id: string
          id: string
          note: string | null
          outstanding_after: number
          period_end: string
          period_start: string | null
        }
        Insert: {
          amount_settled?: number
          closed_at?: string
          closed_by: string
          customer_id: string
          id?: string
          note?: string | null
          outstanding_after?: number
          period_end?: string
          period_start?: string | null
        }
        Update: {
          amount_settled?: number
          closed_at?: string
          closed_by?: string
          customer_id?: string
          id?: string
          note?: string | null
          outstanding_after?: number
          period_end?: string
          period_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_closings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          new_value: Json | null
          previous_value: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          notes: string | null
          spent_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          notes?: string | null
          spent_on?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          notes?: string | null
          spent_on?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message_ar: string
          message_en: string
          order_id: string | null
          recipient_id: string | null
          recipient_role: string
          title_ar: string
          title_en: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message_ar: string
          message_en: string
          order_id?: string | null
          recipient_id?: string | null
          recipient_role: string
          title_ar: string
          title_en: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message_ar?: string
          message_en?: string
          order_id?: string | null
          recipient_id?: string | null
          recipient_role?: string
          title_ar?: string
          title_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name_en_snapshot: string | null
          product_name_snapshot: string
          quantity: number
          unit_price_snapshot: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          product_id?: string | null
          product_name_en_snapshot?: string | null
          product_name_snapshot: string
          quantity: number
          unit_price_snapshot: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name_en_snapshot?: string | null
          product_name_snapshot?: string
          quantity?: number
          unit_price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_token: string | null
          created_at: string
          customer_id: string | null
          customer_language: string
          id: string
          notes: string | null
          order_number: number
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          paid_by: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          visitor_name: string | null
          visitor_phone: string | null
        }
        Insert: {
          client_token?: string | null
          created_at?: string
          customer_id?: string | null
          customer_language?: string
          id?: string
          notes?: string | null
          order_number?: number
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          paid_by?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Update: {
          client_token?: string | null
          created_at?: string
          customer_id?: string | null
          customer_language?: string
          id?: string
          notes?: string | null
          order_number?: number
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          paid_by?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          method: string
          notes: string | null
          order_id: string | null
          paid_on: string
          recorded_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          method?: string
          notes?: string | null
          order_id?: string | null
          paid_on?: string
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          method?: string
          notes?: string | null
          order_id?: string | null
          paid_on?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          image_url: string | null
          is_archived: boolean
          is_available: boolean
          name_ar: string
          name_en: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          is_available?: boolean
          name_ar: string
          name_en: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          is_available?: boolean
          name_ar?: string
          name_en?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_at: string | null
          approved_by: string | null
          created_at: string
          department: string | null
          display_name: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_settings: {
        Row: {
          accent_color: string
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          currency_code: string
          currency_symbol_ar: string
          currency_symbol_en: string
          favicon_url: string | null
          id: string
          logo_url: string | null
          name_ar: string
          name_en: string
          primary_color: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          accent_color?: string
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          currency_code?: string
          currency_symbol_ar?: string
          currency_symbol_en?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          name_ar?: string
          name_en?: string
          primary_color?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          accent_color?: string
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          currency_code?: string
          currency_symbol_ar?: string
          currency_symbol_en?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          name_ar?: string
          name_en?: string
          primary_color?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      sheet_sync_state: {
        Row: {
          created_at: string
          id: string
          row_number: number | null
          sync_key: string
          tab: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          row_number?: number | null
          sync_key: string
          tab: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          row_number?: number | null
          sync_key?: string
          tab?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_config: {
        Row: {
          endpoint_url: string
          id: string
          singleton: boolean
          sync_token: string
          updated_at: string
        }
        Insert: {
          endpoint_url: string
          id?: string
          singleton?: boolean
          sync_token: string
          updated_at?: string
        }
        Update: {
          endpoint_url?: string
          id?: string
          singleton?: boolean
          sync_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          attempted_at: string
          error_message: string | null
          id: string
          record_id: string | null
          retry_count: number
          status: string
          table_name: string
        }
        Insert: {
          attempted_at?: string
          error_message?: string | null
          id?: string
          record_id?: string | null
          retry_count?: number
          status?: string
          table_name: string
        }
        Update: {
          attempted_at?: string
          error_message?: string | null
          id?: string
          record_id?: string | null
          retry_count?: number
          status?: string
          table_name?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      close_account: {
        Args: { _customer_id: string; _note?: string }
        Returns: {
          amount_settled: number
          closed_at: string
          closed_by: string
          customer_id: string
          id: string
          note: string | null
          outstanding_after: number
          period_end: string
          period_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "account_closings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_order: {
        Args: {
          _client_token?: string
          _items: Json
          _language?: string
          _notes?: string
          _order_type: Database["public"]["Enums"]["order_type"]
          _visitor_name?: string
          _visitor_phone?: string
        }
        Returns: string
      }
      customer_accounts_summary: {
        Args: never
        Returns: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          balance: number
          customer_id: string
          department: string
          display_name: string
          email: string
          full_name: string
          last_order_at: string
          last_payment_on: string
          phone: string
          total_ordered: number
          total_paid: number
        }[]
      }
      customer_balance: { Args: { _customer_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_approved_customer: { Args: never; Returns: boolean }
      log_audit: {
        Args: {
          _action: string
          _entity: string
          _entity_id?: string
          _new_value?: Json
          _previous_value?: Json
        }
        Returns: undefined
      }
      mark_order_paid: { Args: { _order_id: string }; Returns: undefined }
      order_number_by_token: {
        Args: { _client_token: string }
        Returns: number
      }
      order_track_by_token: {
        Args: { _client_token: string }
        Returns: {
          created_at: string
          customer_language: string
          order_number: number
          order_type: Database["public"]["Enums"]["order_type"]
          status: Database["public"]["Enums"]["order_status"]
          total: number
        }[]
      }
      order_track_items_by_token: {
        Args: { _client_token: string }
        Returns: {
          line_total: number
          product_name: string
          product_name_en: string
          quantity: number
          unit_price: number
        }[]
      }
      product_sales_report: {
        Args: { _from: string; _to: string }
        Returns: {
          name_ar: string
          name_en: string
          product_id: string
          quantity_sold: number
          revenue: number
        }[]
      }
      run_daily_closing: { Args: never; Returns: undefined }
      set_order_status: {
        Args: {
          _order_id: string
          _status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      void_payment: { Args: { _payment_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "employee"
      approval_status: "pending" | "approved" | "rejected"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready"
        | "completed"
        | "cancelled"
      order_type: "ACCOUNT" | "CASH"
      payment_status: "unpaid" | "paid"
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
      app_role: ["admin", "employee"],
      approval_status: ["pending", "approved", "rejected"],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "completed",
        "cancelled",
      ],
      order_type: ["ACCOUNT", "CASH"],
      payment_status: ["unpaid", "paid"],
    },
  },
} as const
