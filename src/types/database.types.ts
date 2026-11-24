export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "ADMIN" | "PROFESSOR" | "ALUNO";
export type TurnoTipo = "MATUTINO" | "VESPERTINO" | "NOTURNO";
export type AulaStatus = "AGENDADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";
export type RateLimitEventType =
  | "BLOCKED"
  | "REJECTED_WHILE_BLOCKED"
  | "UNBLOCKED_ADMIN"
  | "CONFIG_UPDATED";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nome: string;
          email: string;
          role: UserRole;
          roles: UserRole[];
          titulacao: string | null;
          telefone: string | null;
          must_change_password: boolean;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nome: string;
          email: string;
          role?: UserRole;
          roles?: UserRole[];
          titulacao?: string | null;
          telefone?: string | null;
          must_change_password?: boolean;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          email?: string;
          role?: UserRole;
          roles?: UserRole[];
          titulacao?: string | null;
          telefone?: string | null;
          must_change_password?: boolean;
          ativo?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      professores: {
        Row: {
          id: string;
          user_id: string | null;
          nome: string;
          email: string;
          telefone: string | null;
          titulacao: string;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          nome: string;
          email: string;
          telefone?: string | null;
          titulacao?: string;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string | null;
          nome?: string;
          email?: string;
          telefone?: string | null;
          titulacao?: string;
          ativo?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      disciplinas: {
        Row: {
          id: string;
          codigo: string;
          nome: string;
          carga_horaria: number;
          ementa: string | null;
          ativa: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          nome: string;
          carga_horaria: number;
          ementa?: string | null;
          ativa?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          codigo?: string;
          nome?: string;
          carga_horaria?: number;
          ementa?: string | null;
          ativa?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      turmas: {
        Row: {
          id: string;
          codigo: string;
          nome: string;
          periodo: string;
          turno: TurnoTipo;
          sala_padrao: string | null;
          ativa: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          nome: string;
          periodo: string;
          turno: TurnoTipo;
          sala_padrao?: string | null;
          ativa?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          codigo?: string;
          nome?: string;
          periodo?: string;
          turno?: TurnoTipo;
          sala_padrao?: string | null;
          ativa?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      aulas: {
        Row: {
          id: string;
          disciplina_id: string;
          turma_id: string;
          professor_id: string;
          data_aula: string;
          data_fim: string;
          hora_inicio: string;
          hora_fim: string;
          status: AulaStatus;
          sala: string | null;
          conteudo_programatico: string | null;
          observacoes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          disciplina_id: string;
          turma_id: string;
          professor_id: string;
          data_aula: string;
          data_fim?: string;
          hora_inicio?: string;
          hora_fim?: string;
          status?: AulaStatus;
          sala?: string | null;
          conteudo_programatico?: string | null;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          disciplina_id?: string;
          turma_id?: string;
          professor_id?: string;
          data_aula?: string;
          data_fim?: string;
          hora_inicio?: string;
          hora_fim?: string;
          status?: AulaStatus;
          sala?: string | null;
          conteudo_programatico?: string | null;
          observacoes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "aulas_disciplina_id_fkey";
            columns: ["disciplina_id"];
            isOneToOne: false;
            referencedRelation: "disciplinas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aulas_turma_id_fkey";
            columns: ["turma_id"];
            isOneToOne: false;
            referencedRelation: "turmas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "aulas_professor_id_fkey";
            columns: ["professor_id"];
            isOneToOne: false;
            referencedRelation: "professores";
            referencedColumns: ["id"];
          }
        ];
      };
      termos_uso: {
        Row: {
          id: string;
          titulo: string;
          versao: string;
          conteudo: string;
          ativo: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          titulo: string;
          versao: string;
          conteudo: string;
          ativo?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          titulo?: string;
          versao?: string;
          conteudo?: string;
          ativo?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      termos_aceites: {
        Row: {
          id: string;
          termo_id: string;
          user_id: string;
          latitude: number;
          longitude: number;
          accuracy: number | null;
          user_agent: string | null;
          accepted_at: string;
        };
        Insert: {
          id?: string;
          termo_id: string;
          user_id: string;
          latitude: number;
          longitude: number;
          accuracy?: number | null;
          user_agent?: string | null;
          accepted_at?: string;
        };
        Update: {
          latitude?: number;
          longitude?: number;
          accuracy?: number | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "termos_aceites_termo_id_fkey";
            columns: ["termo_id"];
            isOneToOne: false;
            referencedRelation: "termos_uso";
            referencedColumns: ["id"];
          }
        ];
      };
      rate_limit_config: {
        Row: {
          id: number;
          enabled: boolean;
          bypass_admin: boolean;
          max_requests: number;
          window_seconds: number;
          block_duration_minutes: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          enabled?: boolean;
          bypass_admin?: boolean;
          max_requests?: number;
          window_seconds?: number;
          block_duration_minutes?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          bypass_admin?: boolean;
          max_requests?: number;
          window_seconds?: number;
          block_duration_minutes?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_limit_state: {
        Row: {
          identifier: string;
          user_id: string | null;
          user_email: string | null;
          ip_address: string | null;
          request_count: number;
          window_started_at: string;
          blocked_until: string | null;
          total_blocks: number;
          last_route: string | null;
          last_request_at: string;
          updated_at: string;
        };
        Insert: {
          identifier: string;
          user_id?: string | null;
          user_email?: string | null;
          ip_address?: string | null;
          request_count?: number;
          window_started_at?: string;
          blocked_until?: string | null;
          total_blocks?: number;
          last_route?: string | null;
          last_request_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string | null;
          user_email?: string | null;
          ip_address?: string | null;
          request_count?: number;
          window_started_at?: string;
          blocked_until?: string | null;
          total_blocks?: number;
          last_route?: string | null;
          last_request_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_limit_audit: {
        Row: {
          id: string;
          identifier: string;
          user_id: string | null;
          user_email: string | null;
          ip_address: string | null;
          route: string;
          method: string;
          event_type: RateLimitEventType;
          request_count: number;
          limit_threshold: number;
          blocked_until: string | null;
          details: string | null;
          actor_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          identifier: string;
          user_id?: string | null;
          user_email?: string | null;
          ip_address?: string | null;
          route: string;
          method?: string;
          event_type: RateLimitEventType;
          request_count?: number;
          limit_threshold?: number;
          blocked_until?: string | null;
          details?: string | null;
          actor_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          details?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      turno_tipo: TurnoTipo;
      aula_status: AulaStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
