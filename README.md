# fwd.fm

> FW: FW: FW: ouve essa

**fwd.fm** encaminha música entre streamings diferentes. Você cola links (ou busca pelo nome), gera **um link só**, e cada amigo abre as músicas no app que usa: Spotify, YouTube Music, YouTube, Deezer ou Amazon Music.

Sem login, sem conta, sem instalar nada.

## Como funciona

1. **Cola** links de faixas, álbuns ou playlists do Deezer, ou digita `artista - música`.
2. **Encaminha**: o fwd.fm cria uma página tipo `fwd.fm/m/yAmoCoy`.
3. **Cada um ouve onde quiser**: quem abre escolhe o streaming uma vez (fica salvo no navegador) e cada faixa abre direto lá.

## O que entra e o que sai

| Serviço       | Colar link de faixa | Álbum | Playlist | Abrir como destino |
| ------------- | :-----------------: | :---: | :------: | :----------------: |
| Spotify       |          ✓          |   ✓   |    –     |  ✓ (busca\*)       |
| YouTube Music |          ✓          |   –   |    –     |  ✓ (busca\*)       |
| YouTube       |          ✓          |   –   |    –     |  ✓ (busca\*)       |
| Deezer        |          ✓          |   ✓   |    ✓     |  ✓ link direto     |
| Amazon Music  |          –          |   –   |    –     |  ✓ (busca\*)       |
| Texto livre   |          ✓          |       |          |                    |

\* Sem chaves de API, os destinos sem link direto abrem a **busca do serviço** com `artista + música` já preenchido. Com `SPOTIFY_CLIENT_ID`/`SECRET` o Spotify passa a ter link direto (via ISRC). Com `ODESLI_API_KEY`, todos passam. Veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Rodando localmente

Requisitos: **Node.js 20+** (desenvolvido no Node 24).

```bash
npm install
npm run dev        # http://localhost:3000
```

Produção:

```bash
npm run build
npm start
```

Em dev, o banco SQLite é criado sozinho em `data/fwd.db` (ignorado pelo git). Em produção ele fica no [Turso](https://turso.tech) (libSQL): mesmo SQL, só muda a URL.

### Testes

```bash
npm test            # testes unitários (Vitest), uma vez
npm run test:watch  # modo watch
npm run typecheck
```

## Fluxo de trabalho

```
main  ← produção (deploy automático na Vercel)
 └─ dev  ← staging (deploy de preview na Vercel)
     └─ feat/<nome>, fix/<nome>, chore/<nome>  ← uma branch por feature, cortada da dev
```

1. `git switch dev && git pull && git switch -c feat/minha-feature`
2. Commit, push e PR **para a `dev`**. O GitHub Actions roda typecheck, testes e build.
3. Merge na `dev` → deploy de preview. Quando a `dev` estiver boa, PR `dev → main` → deploy de produção.

### CI/CD (GitHub Actions)

`.github/workflows/ci-cd.yml`:

| Evento | O que roda |
| --- | --- |
| PR para `dev` ou `main` | typecheck, testes, build |
| push na `dev` | CI e, se passar, deploy de **preview** na Vercel |
| push na `main` | CI e, se passar, deploy de **produção** na Vercel |

O deploy só acontece depois dos testes, por isso o `vercel.json` desliga o deploy automático da integração Git da Vercel. Pra ativar, crie em *Settings → Secrets and variables → Actions* do repositório:

| Secret | Onde pegar |
| --- | --- |
| `VERCEL_TOKEN` | vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` depois de rodar `npx vercel link` (campo `orgId`) |
| `VERCEL_PROJECT_ID` | mesmo arquivo (campo `projectId`) |

Sem esses secrets o CI roda normalmente e o deploy é pulado com um aviso. As variáveis do app (`TURSO_*` etc.) ficam na Vercel, separadas por ambiente (Production / Preview): use um banco Turso pra cada um.

### Deploy (Vercel + Turso)

1. Crie o banco no Turso e gere um token:
   ```bash
   turso db create fwd
   turso db show --url fwd        # → TURSO_DATABASE_URL
   turso db tokens create fwd     # → TURSO_AUTH_TOKEN
   ```
2. Importe o repositório na Vercel (framework Next.js, sem configuração extra).
3. Em *Settings → Environment Variables*, adicione `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` (e, se quiser, as chaves opcionais abaixo).
4. Deploy. As tabelas são criadas sozinhas na primeira requisição. Cada push na `main` faz deploy de novo.

Sem `TURSO_DATABASE_URL` na Vercel o app falha de propósito, pra não gravar mixes num disco que some.

### Variáveis de ambiente

Copie `.env.example` para `.env.local`:

| Variável                | Pra quê                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `TURSO_DATABASE_URL`    | Banco em produção (obrigatória na Vercel; em dev usa `data/fwd.db`) |
| `TURSO_AUTH_TOKEN`      | Token do banco Turso                                             |
| `SPOTIFY_CLIENT_ID`     | Links diretos do Spotify via busca por ISRC (Client Credentials) |
| `SPOTIFY_CLIENT_SECRET` | idem                                                             |
| `ODESLI_API_KEY`        | Links diretos pra todos os serviços via song.link                |
| `ODESLI_COUNTRY`        | País usado no song.link (padrão `BR`)                            |

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **libSQL** (`@libsql/client`): arquivo SQLite em dev, Turso em produção
- CSS puro com design tokens, sem framework de UI
- Fontes: Space Grotesk, JetBrains Mono, VT323 (via `next/font`)
- Dados musicais: **Deezer API** (aberta), **oEmbed do YouTube**, **meta tags públicas do Spotify**

## Estrutura

```
app/
  page.tsx                      landing + compositor
  m/[id]/page.tsx               página compartilhada (o "FWD")
  go/[trackId]/[platform]/      redirect pro streaming escolhido
  api/resolve                   POST  links/texto → faixas
  api/search                    GET   busca no Deezer
  api/mixes                     POST  salva um FWD
  globals.css                   todo o visual (ver STYLE_GUIDE.md)
components/                     Composer, MixView, Cover, Eq, Ticker
lib/
  resolve.ts                    leitura de links + match no Deezer
  platforms.ts                  definição dos 5 streamings
  store.ts / db.ts              libSQL (SQLite local / Turso)
  validate.ts                   sanitização do que vem do browser
docs/                           arquitetura, API, roadmap
STYLE_GUIDE.md                  identidade visual e voz
```

## Documentação

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): como um link vira faixa, banco, decisões
- [docs/API.md](docs/API.md): endpoints HTTP
- [docs/ROADMAP.md](docs/ROADMAP.md): próximos passos e limitações conhecidas
- [STYLE_GUIDE.md](STYLE_GUIDE.md): marca, cores, tipografia, componentes e tom de voz
