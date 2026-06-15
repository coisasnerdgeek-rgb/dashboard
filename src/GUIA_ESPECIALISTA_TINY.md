# 👔 Guia Especialista: Integração Tiny ERP & Webhooks

Este guia contém as informações necessárias para gerenciar e depurar a integração entre este Dashboard e o Tiny ERP (MVF e MM).

## 🚀 Como Reativar Webhooks

Se os webhooks pararem de chegar (o Tiny costuma desativá-los automaticamente se houver erro ou lentidão), siga estes passos:

1. Acesse o painel do Tiny.
2. Vá em **Configurações** > **E-commerce** > **Webhooks**.
3. Localize as configurações de **Pedidos** e **Alteração de Situação**.
4. Verifique se a URL está correta: `https://dashboard-pedidos.vercel.app/api/webhook-tiny`
   - **IMPORTANTE**: Antes de colar no Tiny, abra o link acima no seu navegador. Se aparecer uma mensagem: `{"status":"online","message":"Tiny Webhook Listener is active."}`, significa que o link está certo.
5. Clique em **Testar** ou **Validar**. Se o Tiny retornar "OK", o link deve permanecer ativo.
6. Se o link sumir, basta colá-lo novamente e salvar.

> [!TIP]
> O sistema agora responde instantaneamente (200 OK) ao Tiny, mesmo que o processamento demore, para evitar que o link seja "apagado".

## 📊 Estrutura de Integração

O sistema utiliza os seguintes tokens (configurados nas variáveis de ambiente do Vercel):
- `TINY_API_TOKEN` (MVF)
- `TINY_API_TOKEN_MM` (MM)

### Canais Identificados
| Prefixo / Padrão | Canal | Empresa |
| :--- | :--- | :--- |
| `2000...` / `MLB...` | Mercado Livre | VEST (MVF) ou MM |
| `26...` / `2510...` | Shopee | VEST (MVF) ou MM |
| `LU-...` | Magalu | VEST |
| Outros | BUSINESS | - |

## 🛠️ Depuração Técnica

### Webhook Listener
O arquivo [webhook-tiny.ts](file:///c:/Users/micri/Downloads/copy-of-copy-of-copy-of-dashboard-de-pedidos-45/api/webhook-tiny.ts) é a porta de entrada.
- Se o pedido não estiver pronto no Tiny quando o webhook bate, ele entra na **Fila de Retentativa** (`webhook_retry_queue` no Supabase).
- O processamento de retentativas ocorre a cada 2 minutos via Cron.

### Logs
Verifique os logs no Vercel buscando por:
- `🔔 Webhook received`
- `✅ Order processed successfully`
- `⚠️ Order not found - adding to retry queue`
