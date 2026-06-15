# Como obter as Service Role Keys do Supabase

## 1. Service Role Key do BANCO ANTIGO (nbxubdmsepnhhhsbpzoq)

1. Acesse: https://supabase.com/dashboard/project/nbxubdmsepnhhhsbpzoq/settings/api
2. Procure por **"Service Role Key"** (não é a anon key!)
3. Clique em "Reveal" para mostrar a chave
4. Copie a chave completa (começa com `eyJ...`)

## 2. Service Role Key do BANCO NOVO (geabvcqcymaqsqxxfqyw)

1. Acesse: https://supabase.com/dashboard/project/geabvcqcymaqsqxxfqyw/settings/api
2. Procure por **"Service Role Key"** (não é a anon key!)
3. Clique em "Reveal" para mostrar a chave
4. Copie a chave completa (começa com `eyJ...`)

## 3. Como executar o script

1. Abra o arquivo `scripts/migrar-todos-pedidos.ts`
2. Cole as duas Service Role Keys nas linhas indicadas
3. Execute o comando:
   ```bash
   npx tsx scripts/migrar-todos-pedidos.ts
   ```
4. Aguarde a migração completar (pode demorar alguns minutos)

## ⚠️ IMPORTANTE

- A Service Role Key tem permissões TOTAIS no banco
- NÃO compartilhe essa chave publicamente
- NÃO commite ela no Git
- Use APENAS para esta migração
