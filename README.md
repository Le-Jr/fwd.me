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

Requisitos: **Node.js 22.13+** (usa o `node:sqlite` nativo; desenvolvido no Node 24).

```bash
npm install
npm run dev        # http://localhost:3000
```

Produção:

```bash
npm run build
npm start
```

O banco SQLite é criado sozinho em `data/fwd.db` (ignorado pelo git).

### Variáveis de ambiente (todas opcionais)

Copie `.env.example` para `.env.local`:

| Variável                | Pra quê                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `SPOTIFY_CLIENT_ID`     | Links diretos do Spotify via busca por ISRC (Client Credentials) |
| `SPOTIFY_CLIENT_SECRET` | idem                                                             |
| `ODESLI_API_KEY`        | Links diretos pra todos os serviços via song.link                |
| `ODESLI_COUNTRY`        | País usado no song.link (padrão `BR`)                            |

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **SQLite** via `node:sqlite`, sem dependência nativa
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
  store.ts / db.ts              SQLite
  validate.ts                   sanitização do que vem do browser
docs/                           arquitetura, API, roadmap
STYLE_GUIDE.md                  identidade visual e voz
```

## Documentação

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): como um link vira faixa, banco, decisões
- [docs/API.md](docs/API.md): endpoints HTTP
- [docs/ROADMAP.md](docs/ROADMAP.md): próximos passos e limitações conhecidas
- [STYLE_GUIDE.md](STYLE_GUIDE.md): marca, cores, tipografia, componentes e tom de voz
