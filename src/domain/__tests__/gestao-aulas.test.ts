import { describe, it, expect } from "vitest";
import {
  disciplinaSchema,
  turmaSchema,
  professorSchema,
  aulaSchema,
  createUsuarioSchema,
  updateUsuarioSchema,
  termoUsoSchema,
  termoAceiteSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  detectScheduleConflict,
  canManageCatalog,
  canViewAcademicCatalog,
  canUpdateAula,
  formatPhoneBr,
  buildGoogleMapsPinUrl,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsEmbedUrl,
  rateLimitConfigSchema,
  formatRemainingSecondsPtBr,
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
    it("deve permitir gestão de cadastros base apenas para ADMIN (incluindo multi-perfil)", () => {
      expect(canManageCatalog("ADMIN")).toBe(true);
      expect(canManageCatalog(["ADMIN", "PROFESSOR"])).toBe(true);
      expect(canManageCatalog(["PROFESSOR"])).toBe(false);
      expect(canManageCatalog(["ALUNO"])).toBe(false);
    });

    it("deve permitir visualização de Disciplinas e Turmas apenas para ADMIN e PROFESSOR (nunca só ALUNO)", () => {
      expect(canViewAcademicCatalog(["ADMIN"])).toBe(true);
      expect(canViewAcademicCatalog(["PROFESSOR"])).toBe(true);
      expect(canViewAcademicCatalog(["PROFESSOR", "ALUNO"])).toBe(true);
      expect(canViewAcademicCatalog(["ALUNO"])).toBe(false);
    });

    it("deve permitir atualização/edição de aula exclusivamente para ADMIN (Professor e Aluno são somente leitura)", () => {
      expect(
        canUpdateAula({
          userRoles: ["ADMIN"],
          userId: "admin-1",
          aulaProfessorUserId: "prof-user-1",
        })
      ).toBe(true);

      expect(
        canUpdateAula({
          userRoles: ["PROFESSOR"],
          userId: "prof-user-1",
          aulaProfessorUserId: "prof-user-1",
        })
      ).toBe(false);

      expect(
        canUpdateAula({
          userRoles: ["ALUNO"],
          userId: "aluno-user-1",
          aulaProfessorUserId: "prof-user-1",
        })
      ).toBe(false);
    });
  });

  describe("5. Cadastro Unificado de Usuários (Checkboxes) e Termos de Uso", () => {
    it("deve exigir titulação quando o perfil PROFESSOR estiver marcado e permitir apenas um perfil por usuário", () => {
      const semTitulacao = createUsuarioSchema.safeParse({
        nome: "Prof. João Silva",
        email: "joao@unopar.br",
        roles: ["PROFESSOR"],
        titulacao: "",
        password: "Password123!",
        confirmPassword: "Password123!",
      });
      expect(semTitulacao.success).toBe(false);

      const multiplosPerfis = createUsuarioSchema.safeParse({
        nome: "Prof. João Silva",
        email: "joao@unopar.br",
        roles: ["ADMIN", "PROFESSOR"],
        titulacao: "Mestre",
        password: "Password123!",
        confirmPassword: "Password123!",
      });
      expect(multiplosPerfis.success).toBe(false);

      const comTitulacao = createUsuarioSchema.safeParse({
        nome: "Prof. João Silva",
        email: "JOAO@unopar.br",
        roles: ["PROFESSOR"],
        titulacao: "Mestre",
        password: "Password123!",
        confirmPassword: "Password123!",
      });
      expect(comTitulacao.success).toBe(true);
      if (comTitulacao.success) {
        expect(comTitulacao.data.email).toBe("joao@unopar.br");
        expect(comTitulacao.data.roles).toEqual(["PROFESSOR"]);
        expect(comTitulacao.data.titulacao).toBe("Mestre");
      }
    });

    it("deve permitir cadastrar ALUNO sem titulação e zerar titulação se não for PROFESSOR", () => {
      const aluno = createUsuarioSchema.safeParse({
        nome: "Maria Oliveira",
        email: "maria@unopar.br",
        roles: ["ALUNO"],
        titulacao: "Mestre",
        password: "Password123!",
        confirmPassword: "Password123!",
      });
      expect(aluno.success).toBe(true);
      if (aluno.success) {
        expect(aluno.data.titulacao).toBeNull();
      }
    });

    it("deve rejeitar cadastro de usuário sem perfil marcado ou com senhas divergentes", () => {
      expect(
        createUsuarioSchema.safeParse({
          nome: "Sem Perfil",
          email: "sem@unopar.br",
          roles: [],
          password: "Password123!",
          confirmPassword: "Password123!",
        }).success
      ).toBe(false);

      expect(
        createUsuarioSchema.safeParse({
          nome: "Senha Diferente",
          email: "dif@unopar.br",
          roles: ["ALUNO"],
          password: "Password123!",
          confirmPassword: "OutraSenha123!",
        }).success
      ).toBe(false);
    });

    it("deve permitir editar usuário mantendo a senha atual em branco", () => {
      const edit = updateUsuarioSchema.safeParse({
        nome: "Maria Oliveira Atualizada",
        email: "maria@unopar.br",
        roles: ["ALUNO"],
        password: "",
        confirmPassword: "",
      });
      expect(edit.success).toBe(true);
      if (edit.success) {
        expect(edit.data.password).toBeUndefined();
      }
    });

    it("deve validar cadastro de Termo de Uso e registro de aceite com latitude/longitude", () => {
      expect(
        termoUsoSchema.safeParse({
          titulo: "Termos de Uso UnoparSystem",
          versao: "2.0",
          conteudo: "Texto completo dos termos de uso do sistema acadêmico.",
          ativo: true,
        }).success
      ).toBe(true);

      expect(
        termoAceiteSchema.safeParse({
          termo_id: "77b80c23-0c3d-4d28-9416-14f3b679eeb4",
          latitude: -23.304452,
          longitude: -51.169582,
          accuracy: 15,
        }).success
      ).toBe(true);

      expect(
        termoAceiteSchema.safeParse({
          termo_id: "77b80c23-0c3d-4d28-9416-14f3b679eeb4",
          latitude: 120,
          longitude: -51.169582,
        }).success
      ).toBe(false);
    });

    it("deve gerar URLs corretas do Google Maps para pin, embed e rota", () => {
      expect(buildGoogleMapsPinUrl(-23.304452, -51.169582)).toBe(
        "https://www.google.com/maps/search/?api=1&query=-23.304452,-51.169582"
      );
      expect(buildGoogleMapsDirectionsUrl(-23.304452, -51.169582)).toBe(
        "https://www.google.com/maps/dir/?api=1&destination=-23.304452,-51.169582"
      );
      expect(buildGoogleMapsEmbedUrl(-23.304452, -51.169582)).toBe(
        "https://maps.google.com/maps?q=-23.304452,-51.169582&z=16&output=embed"
      );
    });
  });

  describe("6. Parâmetros de Rate Limit e Formatação de Tempo", () => {
    it("deve validar configuração padrão de 50 requests, janela e tempo de bloqueio", () => {
      const valid = rateLimitConfigSchema.safeParse({
        enabled: true,
        bypass_admin: true,
        max_requests: 50,
        window_seconds: 60,
        block_duration_minutes: 15,
      });
      expect(valid.success).toBe(true);
    });

    it("deve rejeitar limites ou tempos de bloqueio inválidos", () => {
      expect(
        rateLimitConfigSchema.safeParse({
          enabled: true,
          bypass_admin: true,
          max_requests: 0,
          window_seconds: 60,
          block_duration_minutes: 15,
        }).success
      ).toBe(false);

      expect(
        rateLimitConfigSchema.safeParse({
          enabled: true,
          bypass_admin: true,
          max_requests: 50,
          window_seconds: 5,
          block_duration_minutes: 15,
        }).success
      ).toBe(false);

      expect(
        rateLimitConfigSchema.safeParse({
          enabled: true,
          bypass_admin: true,
          max_requests: 50,
          window_seconds: 60,
          block_duration_minutes: 0,
        }).success
      ).toBe(false);
    });

    it("deve formatar corretamente o tempo restante de bloqueio em português", () => {
      expect(formatRemainingSecondsPtBr(45)).toBe("45s");
      expect(formatRemainingSecondsPtBr(125)).toBe("2min 5s");
      expect(formatRemainingSecondsPtBr(900)).toBe("15min");
      expect(formatRemainingSecondsPtBr(3660)).toBe("1h 1min");
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
