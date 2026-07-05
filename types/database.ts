export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ProfileRole = "teacher" | "student";
export type PaperSource = "uploaded" | "ai_generated";
export type QuestionType = "mcq" | "subjective";
export type TestStatus = "draft" | "scheduled" | "completed";
export type SubmissionStatus = "pending" | "graded";

export type Database = {
  public: {
    Enums: {
      profile_role: ProfileRole;
      paper_source: PaperSource;
      question_type: QuestionType;
      test_status: TestStatus;
      submission_status: SubmissionStatus;
    };
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: ProfileRole;
          full_name: string;
          phone: string | null;
          is_placeholder: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          role: ProfileRole;
          full_name?: string;
          phone?: string | null;
          is_placeholder?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      batches: {
        Row: {
          id: string;
          teacher_id: string;
          name: string;
          subject: string;
          exam_target: string;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          name: string;
          subject: string;
          exam_target: string;
          invite_code: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["batches"]["Insert"]>;
        Relationships: [];
      };
      batch_students: {
        Row: {
          batch_id: string;
          student_id: string;
          joined_at: string;
        };
        Insert: {
          batch_id: string;
          student_id: string;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["batch_students"]["Insert"]>;
        Relationships: [];
      };
      question_papers: {
        Row: {
          id: string;
          teacher_id: string;
          batch_id: string;
          title: string;
          source: PaperSource;
          file_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          batch_id: string;
          title: string;
          source: PaperSource;
          file_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["question_papers"]["Insert"]>;
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          question_paper_id: string;
          question_text: string;
          question_type: QuestionType;
          topic: string;
          options: Json | null;
          correct_answer: string | null;
          max_marks: number;
          rubric: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_paper_id: string;
          question_text: string;
          question_type: QuestionType;
          topic?: string;
          options?: Json | null;
          correct_answer?: string | null;
          max_marks?: number;
          rubric?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["questions"]["Insert"]>;
        Relationships: [];
      };
      tests: {
        Row: {
          id: string;
          question_paper_id: string;
          batch_id: string;
          title: string;
          scheduled_at: string;
          duration_minutes: number;
          status: TestStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_paper_id: string;
          batch_id: string;
          title: string;
          scheduled_at: string;
          duration_minutes: number;
          status?: TestStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tests"]["Insert"]>;
        Relationships: [];
      };
      test_submissions: {
        Row: {
          id: string;
          test_id: string;
          student_id: string;
          submitted_at: string | null;
          status: SubmissionStatus;
        };
        Insert: {
          id?: string;
          test_id: string;
          student_id: string;
          submitted_at?: string | null;
          status?: SubmissionStatus;
        };
        Update: Partial<Database["public"]["Tables"]["test_submissions"]["Insert"]>;
        Relationships: [];
      };
      answers: {
        Row: {
          id: string;
          submission_id: string;
          question_id: string;
          student_answer: string;
          ai_suggested_marks: number | null;
          awarded_marks: number | null;
          ai_feedback: string | null;
          teacher_feedback: string | null;
          approved_at: string | null;
        };
        Insert: {
          id?: string;
          submission_id: string;
          question_id: string;
          student_answer?: string;
          ai_suggested_marks?: number | null;
          awarded_marks?: number | null;
          ai_feedback?: string | null;
          teacher_feedback?: string | null;
          approved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["answers"]["Insert"]>;
        Relationships: [];
      };
      progress_snapshots: {
        Row: {
          id: string;
          student_id: string;
          batch_id: string;
          test_id: string;
          score_percent: number;
          topic_breakdown: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          batch_id: string;
          test_id: string;
          score_percent: number;
          topic_breakdown?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["progress_snapshots"]["Insert"]>;
        Relationships: [];
      };
      ai_usage_events: {
        Row: {
          id: string;
          owner_teacher_id: string;
          actor_id: string;
          feature: string;
          input_tokens: number;
          output_tokens: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_teacher_id: string;
          actor_id: string;
          feature: string;
          input_tokens?: number;
          output_tokens?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_usage_events"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      join_batch_by_invite: {
        Args: { p_invite_code: string };
        Returns: string;
      };
      get_student_test_questions: {
        Args: { p_test_id: string };
        Returns: {
          id: string;
          question_text: string;
          question_type: QuestionType;
          topic: string;
          options: Json | null;
          max_marks: number;
        }[];
      };
    };
    CompositeTypes: Record<string, never>;
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
