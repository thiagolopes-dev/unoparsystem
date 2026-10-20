-- Template base de Row Level Security (RLS) para Supabase
-- Substitua <table_name> e ajuste a coluna de ownership (ex.: user_id, tenant_id)

ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- SELECT: Usuário autenticado lê apenas seus próprios registros
CREATE POLICY "<table_name>_select_own"
ON public.<table_name>
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

-- INSERT: Usuário autenticado insere apenas registros vinculados a si mesmo
CREATE POLICY "<table_name>_insert_own"
ON public.<table_name>
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

-- UPDATE: Usuário autenticado atualiza apenas seus próprios registros
CREATE POLICY "<table_name>_update_own"
ON public.<table_name>
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- DELETE: Usuário autenticado remove apenas seus próprios registros
CREATE POLICY "<table_name>_delete_own"
ON public.<table_name>
FOR DELETE
TO authenticated
USING ((select auth.uid()) = user_id);

-- Índice obrigatório para performance da política RLS
CREATE INDEX IF NOT EXISTS idx_<table_name>_user_id ON public.<table_name>(user_id);
