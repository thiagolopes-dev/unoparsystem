export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "ADMIN" | "PROFESSOR";
export type TurnoTipo = "MATUTINO" | "VESPERTINO" | "NOTURNO";
export type AulaStatus = "AGENDADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nome: string;
          email: string;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nome: string;
          email: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          email?: string;
          role?: UserRole;
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
          hora_inicio: string;
          hora_fim: string;
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
