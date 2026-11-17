import { describe, it, expect } from "vitest";
import {
  disciplinaSchema,
  turmaSchema,
  professorSchema,
  aulaSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  detectScheduleConflict,
  canManageCatalog,
  canUpdateAula,
  formatPhoneBr,
  type ExistingAulaSlot,
} from "../gestao-aulas";

describe("TDD - Domínio de Gestão de Aulas", () => {
  describe("1. Validação de Schemas (Zod)", () => {
    it("deve validar disciplina com dados corretos", () => {
      const result = disciplinaSchema.safeParse({
        codigo: "eng-401",
        nome: "Arquitetura de Sistemas",
        carga_horaria: 80,
        ementa: "Clean Architecture e DDD",
        ativa: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.codigo).toBe("ENG-401"); // normalizado para uppercase
      }
    });

    it("deve rejeitar disciplina com carga horária inválida", () => {
      const result = disciplinaSchema.safeParse({
        codigo: "ENG-401",
        nome: "Arquitetura",
        carga_horaria: 0,
      });
      expect(result.success).toBe(false);
    });

    it("deve validar turma com turno válido", () => {
      const result = turmaSchema.safeParse({
        codigo: "ads-4n",
        nome: "ADS 4º Semestre",
        periodo: "2026.2",
        turno: "NOTURNO",
        sala_padrao: "Lab 03",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.codigo).toBe("ADS-4N");
      }
    });

    it("deve validar professor com email institucional válido", () => {
      const result = professorSchema.safeParse({
        nome: "Prof. Dr. Ricardo Mendes",
        email: "RICARDO@unopar.br",
        telefone: "(43) 99911-2233",
        titulacao: "Doutor",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("ricardo@unopar.br");
        expect(result.data.telefone).toBe("(43) 99911-2233");
      }
    });

    it("deve formatar telefone com máscara brasileira e rejeitar telefones inválidos", () => {
      expect(formatPhoneBr("43999112233")).toBe("(43) 99911-2233");
      expect(formatPhoneBr("4333445566")).toBe("(43) 3344-5566");
      expect(formatPhoneBr("4399")).toBe("(43) 99");
      expect(formatPhoneBr("439991122334455")).toBe("(43) 99911-2233");
      expect(formatPhoneBr("")).toBe("");

      const validLandline = professorSchema.safeParse({
        nome: "Prof. Ana Paula",
        email: "ana@unopar.br",
        telefone: "4333445566",
        titulacao: "Mestre",
      });
      expect(validLandline.success).toBe(true);
      if (validLandline.success) {
        expect(validLandline.data.telefone).toBe("(43) 3344-5566");
      }

      const emptyPhone = professorSchema.safeParse({
        nome: "Prof. Ana Paula",
        email: "ana@unopar.br",
        telefone: null,
        titulacao: "Mestre",
      });
      expect(emptyPhone.success).toBe(true);
      if (emptyPhone.success) {
        expect(emptyPhone.data.telefone).toBeNull();
      }

      const invalidShortPhone = professorSchema.safeParse({
        nome: "Prof. Ana Paula",
        email: "ana@unopar.br",
        telefone: "342343",
        titulacao: "Mestre",
      });
      expect(invalidShortPhone.success).toBe(false);

      const invalidLongPhone = professorSchema.safeParse({
        nome: "Prof. Ana Paula",
        email: "ana@unopar.br",
        telefone: "45345345345345345345",
        titulacao: "Mestre",
      });
      expect(invalidLongPhone.success).toBe(false);
    });

    it("deve validar aula com data inicial e data final sem informar horários", () => {
      const result = aulaSchema.safeParse({
        disciplina_id: "b1111111-1111-1111-1111-111111111111",
        turma_id: "c1111111-1111-1111-1111-111111111111",
        professor_id: "a1111111-1111-1111-1111-111111111111",
        data_aula: "2026-03-02",
        data_fim: "2026-03-06",
        status: "AGENDADA",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data_aula).toBe("2026-03-02");
        expect(result.data.data_fim).toBe("2026-03-06");
        expect(result.data.hora_inicio).toBe("08:00");
        expect(result.data.hora_fim).toBe("22:00");
      }
    });

    it("deve rejeitar aula quando data_fim for anterior a data_aula", () => {
      const result = aulaSchema.safeParse({
        disciplina_id: "b1111111-1111-1111-1111-111111111111",
        turma_id: "c1111111-1111-1111-1111-111111111111",
        professor_id: "a1111111-1111-1111-1111-111111111111",
        data_aula: "2026-03-10",
        data_fim: "2026-03-05",
        status: "AGENDADA",
      });
      expect(result.success).toBe(false);
    });

    it("deve rejeitar aula quando hora_fim for menor ou igual a hora_inicio", () => {
      const result = aulaSchema.safeParse({
        disciplina_id: "b1111111-1111-1111-1111-111111111111",
        turma_id: "c1111111-1111-1111-1111-111111111111",
        professor_id: "a1111111-1111-1111-1111-111111111111",
        data_aula: "2026-10-20",
        hora_inicio: "20:40",
        hora_fim: "19:00",
        status: "AGENDADA",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("2. Detecção de Choque de Horários (Professor e Turma)", () => {
    const existingSlots: ExistingAulaSlot[] = [
      {
        id: "aula-1",
        professor_id: "prof-1",
        turma_id: "turma-1",
        data_aula: "2026-10-20",
        hora_inicio: "19:00",
        hora_fim: "20:40",
        status: "AGENDADA",
      },
      {
        id: "aula-cancelada",
        professor_id: "prof-2",
        turma_id: "turma-2",
        data_aula: "2026-10-20",
        hora_inicio: "19:00",
        hora_fim: "20:40",
        status: "CANCELADA",
      },
    ];

    it("deve detectar conflito quando o mesmo professor já possui aula no intervalo sobreposto", () => {
      const conflict = detectScheduleConflict(
        {
          professor_id: "prof-1",
          turma_id: "turma-2",
          data_aula: "2026-10-20",
          hora_inicio: "20:00",
          hora_fim: "21:30",
          status: "AGENDADA",
        },
        existingSlots
      );

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.reason).toBe("PROFESSOR_CONFLICT");
    });

    it("deve detectar conflito quando a mesma turma já possui aula no intervalo sobreposto", () => {
      const conflict = detectScheduleConflict(
        {
          professor_id: "prof-3",
          turma_id: "turma-1",
          data_aula: "2026-10-20",
          hora_inicio: "19:30",
          hora_fim: "21:00",
          status: "AGENDADA",
        },
        existingSlots
      );

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.reason).toBe("TURMA_CONFLICT");
    });

    it("deve permitir horários adjacentes sem sobreposição (ex: 20:40 às 22:30 após 19:00 às 20:40)", () => {
      const conflict = detectScheduleConflict(
        {
          professor_id: "prof-1",
          turma_id: "turma-1",
          data_aula: "2026-10-20",
          hora_inicio: "20:40",
          hora_fim: "22:30",
          status: "AGENDADA",
        },
        existingSlots
      );

      expect(conflict.hasConflict).toBe(false);
    });

    it("deve ignorar aulas com status CANCELADA ao verificar choque de horário", () => {
      const conflict = detectScheduleConflict(
        {
          professor_id: "prof-2",
          turma_id: "turma-2",
          data_aula: "2026-10-20",
          hora_inicio: "19:00",
          hora_fim: "20:40",
          status: "AGENDADA",
        },
        existingSlots
      );

      expect(conflict.hasConflict).toBe(false);
    });

    it("deve ignorar a própria aula ao editar uma aula existente (excludeId)", () => {
      const conflict = detectScheduleConflict(
        {
          id: "aula-1",
          professor_id: "prof-1",
          turma_id: "turma-1",
          data_aula: "2026-10-20",
          hora_inicio: "19:00",
          hora_fim: "20:40",
          status: "EM_ANDAMENTO",
        },
        existingSlots
      );

      expect(conflict.hasConflict).toBe(false);
    });
  });

  describe("3. Controle de Acesso Baseado em Papel (RBAC)", () => {
    it("deve permitir gestão de cadastros base apenas para ADMIN", () => {
      expect(canManageCatalog("ADMIN")).toBe(true);
      expect(canManageCatalog("PROFESSOR")).toBe(false);
    });

    it("deve permitir atualização de aula para ADMIN ou para o PROFESSOR responsável pela aula", () => {
      expect(
        canUpdateAula({
          userRole: "ADMIN",
          userId: "admin-1",
          aulaProfessorUserId: "prof-user-1",
        })
      ).toBe(true);

      expect(
        canUpdateAula({
          userRole: "PROFESSOR",
          userId: "prof-user-1",
          aulaProfessorUserId: "prof-user-1",
        })
      ).toBe(true);

      expect(
        canUpdateAula({
          userRole: "PROFESSOR",
          userId: "prof-user-2",
          aulaProfessorUserId: "prof-user-1",
        })
      ).toBe(false);
    });
  });

  describe("4. Recuperação e Redefinição de Senha", () => {
    it("deve normalizar o e-mail para lowercase e remover espaços em forgotPasswordSchema", () => {
      const result = forgotPasswordSchema.safeParse({
        email: "  Professor.Teste@Unopar.BR  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("professor.teste@unopar.br");
      }
    });

    it("deve rejeitar e-mail inválido ou vazio em forgotPasswordSchema", () => {
      expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
      expect(
        forgotPasswordSchema.safeParse({ email: "email-invalido" }).success
      ).toBe(false);
    });

    it("deve aprovar resetPasswordSchema quando senha e confirmação coincidirem com >= 6 caracteres", () => {
      const result = resetPasswordSchema.safeParse({
        password: "NovaSenha123!",
        confirmPassword: "NovaSenha123!",
      });
      expect(result.success).toBe(true);
    });

    it("deve rejeitar resetPasswordSchema quando a senha tiver menos de 6 caracteres", () => {
      const result = resetPasswordSchema.safeParse({
        password: "12345",
        confirmPassword: "12345",
      });
      expect(result.success).toBe(false);
    });

    it("deve rejeitar resetPasswordSchema quando as senhas não coincidirem", () => {
      const result = resetPasswordSchema.safeParse({
        password: "NovaSenha123!",
        confirmPassword: "OutraSenha123!",
      });
      expect(result.success).toBe(false);
    });
  });
});
