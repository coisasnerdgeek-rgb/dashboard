# Como Fazer Deploy das Suas Alterações

As suas alterações estão apenas no código **local** e ainda não foram enviadas para o Vercel. 

## Opção 1: Vercel CLI (Recomendado - Mais Rápido)

```bash
# Instalar Vercel CLI (apenas uma vez)
npm install -g vercel

# Fazer deploy
vercel --prod
```

Na primeira vez, vai pedir para fazer login. Depois é só confirmar as opções.

## Opção 2: Git + Push

Se você já tem Git instalado e configurado:

```bash
git add .
git commit -m "feat: UI improvements - rename, multi-select, SKU editing"
git push
```

Se não tem Git, baixe em: https://git-scm.com/download/win

## Opção 3: Redeploy Manual

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em "Deployments"
4. Clique em "Redeploy" no último deployment

## Verificar Deploy

Após o deploy, acesse:
- https://copy-of-dashboard-d.vercel.app

O deploy leva cerca de 1-2 minutos.
