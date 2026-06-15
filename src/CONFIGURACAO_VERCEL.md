# Guia de Configuração: Dashboard de Pedidos no Vercel

Siga os passos abaixo para atualizar o site oficial com o novo banco de dados.

## 1. Variáveis de Ambiente
Acesse o painel da Vercel (**Settings > Environment Variables**) e atualize as seguintes variáveis:

### Obrigatórias (Banco Novo)
| Nome da Variável | Valor |
| :--- | :--- |
| **VITE_SUPABASE_URL** | `https://geabvcqcymaqsqxxfqyw.supabase.co` |
| **VITE_SUPABASE_ANON_KEY** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYWJ2Y3FjeW1hcXNxeHhmcXl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxODEwOTcsImV4cCI6MjA4NDc1NzA5N30.U6JWAUQgMMj_u6S7ZHisf9vG-LL0IwM5QyoD5OT97Ro` |

### Google e Integrações
| Nome da Variável | Valor |
| :--- | :--- |
| **VITE_GOOGLE_API_KEY** | `AIzaSyB5nrL6cbIns8GtM3Yvwq1FRjJetDb7K3M` |
| **VITE_GOOGLE_CLIENT_ID** | `712795306362-u6g9kmlq2as3f79fcumtmapn1fjog4vu.apps.googleusercontent.com` |

---

## 2. Como Aplicar as Mudanças
Após salvar as variáveis acima:
1. Vá na aba **Deployments** na Vercel.
2. Localize o último deploy (o que está no topo da lista).
3. Clique nos três pontinhos (`...`) à direita.
4. Selecione **Redeploy**.
5. Clique no botão de confirmação **Redeploy**.

---

## 3. Verificação Final
Assim que o build terminar:
- Abra o link do seu site (dashboard-pedidos.vercel.app).
- Verifique se os **60.823 pedidos** aparecem.
- Verifique se a aba **"Imagens"** está carregando suas fotos.
- Teste a aba **"Atrasados"** e **"Preços"**.

✅ **Se tudo estiver correto, seu sistema está oficialmente migrado e pronto para uso!**
