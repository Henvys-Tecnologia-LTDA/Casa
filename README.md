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

## Banco

As migrations ficam em `supabase/migrations`. O app só usa a URL e a chave publicável do Supabase
(`src/lib/config.ts`); quem protege os dados é o RLS por membro do casal.
