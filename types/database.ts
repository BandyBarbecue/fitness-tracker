// types/database.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      daily_logs: {
        Row: {
          id: string
          user_id: string
          date: string
          weight_kg: number | null
          calories: number | null
          protein_g: number | null
          fat_g: number | null
          carbs_g: number | null
          steps: number | null
          session_type: 'push' | 'pull' | 'legs' | 'upper' | 'rest' | 'cardio' | null
          sleep_hours: number | null
          mood: number | null
          water_l: number | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          weight_kg?: number | null
          calories?: number | null
          protein_g?: number | null
          fat_g?: number | null
          carbs_g?: number | null
          steps?: number | null
          session_type?: 'push' | 'pull' | 'legs' | 'upper' | 'rest' | 'cardio' | null
          sleep_hours?: number | null
          mood?: number | null
          water_l?: number | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          weight_kg?: number | null
          calories?: number | null
          protein_g?: number | null
          fat_g?: number | null
          carbs_g?: number | null
          steps?: number | null
          session_type?: 'push' | 'pull' | 'legs' | 'upper' | 'rest' | 'cardio' | null
          sleep_hours?: number | null
          mood?: number | null
          water_l?: number | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      food_screenshots: {
        Row: {
          id: string
          user_id: string
          daily_log_id: string | null
          meal_log_id: string | null
          image_path: string
          extracted_json: Json | null
          confirmed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          daily_log_id?: string | null
          meal_log_id?: string | null
          image_path: string
          extracted_json?: Json | null
          confirmed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          daily_log_id?: string | null
          meal_log_id?: string | null
          image_path?: string
          extracted_json?: Json | null
          confirmed?: boolean
          created_at?: string
        }
      }
      meal_logs: {
        Row: {
          id: string
          user_id: string
          date: string
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          calories: number | null
          protein_g: number | null
          fat_g: number | null
          carbs_g: number | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          calories?: number | null
          protein_g?: number | null
          fat_g?: number | null
          carbs_g?: number | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          calories?: number | null
          protein_g?: number | null
          fat_g?: number | null
          carbs_g?: number | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      progress_photos: {
        Row: {
          id: string
          user_id: string
          date: string
          image_path: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          image_path: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          image_path?: string
          note?: string | null
          created_at?: string
        }
      }
      targets: {
        Row: {
          id: string
          user_id: string
          calories: number
          protein_g: number
          fat_g: number
          carbs_g: number
          steps: number
          goal_rate_kg_per_week: number
          bodyweight_kg: number
          height_cm: number
          training_split: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          calories?: number
          protein_g?: number
          fat_g?: number
          carbs_g?: number
          steps?: number
          goal_rate_kg_per_week?: number
          bodyweight_kg?: number
          height_cm?: number
          training_split?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          calories?: number
          protein_g?: number
          fat_g?: number
          carbs_g?: number
          steps?: number
          goal_rate_kg_per_week?: number
          bodyweight_kg?: number
          height_cm?: number
          training_split?: string
          updated_at?: string
        }
      }
      ai_checkins: {
        Row: {
          id: string
          user_id: string
          created_at: string
          period_start: string
          period_end: string
          summary_text: string
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
          period_start: string
          period_end: string
          summary_text: string
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          period_start?: string
          period_end?: string
          summary_text?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
