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
