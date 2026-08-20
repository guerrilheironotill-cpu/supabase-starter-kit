# Migração definitiva para arteno.com.br

Este procedimento mantém uma resposta HTTP 503 de manutenção até a aprovação final.

## Ambiente da aplicação no VPS

```env
APP_ENV=production
VITE_APP_ENV=production
VITE_SITE_URL=https://arteno.com.br
SITE_URL=https://arteno.com.br
MAINTENANCE_MODE=true
MAINTENANCE_BYPASS_TOKEN=<token-longo-aleatorio>
```

O valor de `MAINTENANCE_BYPASS_TOKEN` é secreto. Para revisar o site, acesse uma única vez:

```text
https://arteno.com.br/?preview=<token-longo-aleatorio>
```

O servidor grava um cookie seguro por 24 horas e remove o token da URL.

## Supabase Auth

- Site URL: `https://arteno.com.br`
- Redirect URLs durante a transição:
  - `https://arteno.com.br/**`
  - `https://novo.arteno.com.br/**`

Atualizar também o secret `SITE_URL=https://arteno.com.br` usado pela função `notify-new-order`.

## Proxy e SSL

- Fazer `arteno.com.br` encaminhar para a aplicação Node/PM2.
- Preservar o alias persistente `/uploads`.
- Redirecionar `www.arteno.com.br` para `https://arteno.com.br`.
- Manter `novo.arteno.com.br` disponível durante a revisão; depois da aprovação, o aplicativo faz o redirecionamento canônico para a raiz.
- Confirmar certificado válido para raiz, `www` e `novo`.

## Liberação após aprovação

1. Alterar `MAINTENANCE_MODE=false`.
2. Reiniciar a aplicação com o ambiente atualizado.
3. Confirmar `/`, `/robots.txt`, `/sitemap.xml`, `/google-shopping.xml`, produtos e redirects antigos.
4. Enviar o sitemap raiz ao Google Search Console.

Não é necessário gerar outro build apenas para desligar a manutenção; a leitura dessa variável ocorre em tempo de execução.
