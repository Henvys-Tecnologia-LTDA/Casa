# Casa a Dois

App de planejamento do casal (compras da casa por cômodo, console, simulador do apê, mudança, viagens e dinheiro),
feito com Expo (React Native + expo-router) e Supabase. Cada casal só vê os próprios dados.

## Rodar

```bash
npm install
npx expo start --web
```

## Publicar

- **Web (Vercel):** cada push na `main` gera um deploy. A configuração está em `vercel.json`
  (`npx expo export -p web`, pasta `dist`).
- **Android (APK):** `npx eas-cli build -p android --profile preview`.

## Ícones

A marca fica em `assets/brand/marca.svg`. Depois de mexer nela, gere de novo os PNGs de `assets/images`
(ícone, adaptive icon do Android, splash e favicon) e os de `public/` (ícones para instalar a web na tela
de início e a casinha que aparece enquanto o JS carrega). O sharp não entra no `package.json`:

```bash
npm i --no-save sharp && node scripts/make-icons.mjs
```

## Banco

As migrations ficam em `supabase/migrations`. O app só usa a URL e a chave publicável do Supabase
(`src/lib/config.ts`); quem protege os dados é o RLS por membro do casal.

## Avisos

Quando alguém adiciona ou conclui algo, os outros membros do casal recebem um aviso. Cada um escolhe o que
quer receber em Ajustes → Avisos (por aba, "novos" e "concluídos", ou pausar tudo).

- Gatilhos no banco anotam os eventos; um cron por minuto chama a Edge Function `notify`
  (`supabase/functions/notify`), que junta o que a mesma pessoa fez na mesma aba e manda um aviso só,
  cerca de 1 minuto depois da última mudança.
- **Android:** pelo Expo push, no APK. Precisa do Firebase: `google-services.json` na raiz (referenciado
  em `android.googleServicesFile` no `app.json`) e a chave da conta de serviço do Firebase (FCM V1)
  enviada em expo.dev → Credentials. A chave da conta de serviço nunca entra no repositório.
- **iPhone e computador:** web push pelo site (`public/sw.js`). No iPhone só funciona com o site
  adicionado à Tela de Início (iOS 16.4 ou mais novo).
- Para publicar a função de novo: `npx supabase functions deploy notify --no-verify-jwt` (ela confere
  uma senha guardada no Vault em vez do JWT).
