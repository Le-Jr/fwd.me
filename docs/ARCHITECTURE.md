# Arquitetura

## Visão geral

```
 navegador                        servidor Next.js                       fontes externas
┌──────────────┐  POST /api/resolve  ┌───────────────┐   meta tags     ┌──────────────┐
│  Composer    │ ──────────────────▶ │ lib/resolve   │ ──────────────▶ │ Spotify page │
│  (cola/busca)│ ◀── faixas ──────── │               │   oEmbed        │ YouTube      │
│              │  GET /api/search    │               │ ──────────────▶ │              │
│              │ ──────────────────▶ │               │   search/track  │ Deezer API   │
│              │  POST /api/mixes    ├───────────────┤ ──────────────▶ │  (match+ISRC)│
│              │ ──────────────────▶ │ lib/store     │                 └──────────────┘
└──────────────┘                     │  SQLite       │
┌──────────────┐  GET /m/:id         │  data/fwd.db  │   opcionais     ┌──────────────┐
│  MixView     │ ──────────────────▶ │               │ ──────────────▶ │ Spotify API  │
│  (amigo)     │  GET /go/:t/:p ───▶ │ lookupLinks   │                 │ song.link    │
└──────────────┘  ◀── 307 redirect ─ └───────────────┘                 └──────────────┘
```

## Como um link vira uma faixa

`lib/resolve.ts` → `resolveInput(texto)` processa **linha por linha**:

| Entrada                          | Leitura                                         | Resultado                         |
| -------------------------------- | ----------------------------------------------- | --------------------------------- |
| `deezer.com/track/…`             | Deezer API `track/:id`                          | 1 faixa (com ISRC)                |
| `deezer.com/album/…`             | Deezer API `album/:id`                          | N faixas                          |
| `deezer.com/playlist/…`          | Deezer API paginada (100 por página, até 500)   | N faixas                          |
| `link.deezer.com`, `spotify.link`| segue o redirect e reprocessa                   |                                   |
| `open.spotify.com/track/…`       | meta tags `og:title` + `music:musician_description` | match no Deezer → 1 faixa     |
| `open.spotify.com/album/…`       | meta tags → `search/album` no Deezer            | N faixas                          |
| `youtube.com/watch?v=`, `youtu.be`, `music.youtube.com` | oEmbed + limpeza do título | match no Deezer → 1 faixa  |
| texto livre                      | Deezer `search`, 1º resultado                   | 1 faixa                           |
| playlist Spotify/YouTube, Amazon | erro amigável (ver ROADMAP)                     |                                   |

### O match

`matchOnDeezer(artista, título)` busca os 5 primeiros resultados no Deezer e escolhe o primeiro cujo artista "bate" (normalizado sem acento/pontuação, comparando por inclusão); se nenhum bater, usa o primeiro. O Deezer devolve **ISRC**, o código universal da gravação, que é a chave pra achar a mesma faixa em outros serviços.

Os títulos do YouTube são limpos por `parseYoutubeTitle`: remove `(Official Video)`, `[Clipe Oficial]`, `- Topic` do canal etc., e separa `Artista - Música`.

### Por que não o song.link (Odesli)?

O plano original era usar a API pública do song.link. Em novembro de 2026 ela passou a responder `401 PUBLIC_API_ACCESS_DEPRECATED`. Ela continua suportada **com chave** (`ODESLI_API_KEY`), mas o app não depende dela.

## Resolução preguiçosa (`/go/:trackId/:platform`)

Salvar um FWD **não** resolve todos os serviços na hora. Isso deixaria a criação lenta e estouraria limites de API em playlists longas. Em vez disso:

1. O amigo clica em "abrir" → `GET /go/:trackId/:platform`
2. Se a faixa já tem link pra esse serviço → redirect `307`
3. Se não, e a faixa nunca foi resolvida (`resolved_at IS NULL`), chama `lookupLinks()`:
   - song.link (se houver chave)
   - Deezer por ISRC, ou por match de texto
   - Spotify Web API por ISRC (se houver chave)
   - grava os links e marca `resolved_at`
4. Sem link → redirect para a **busca** do serviço com `artista + título`

Se uma API externa responder com rate limit, `lookupLinks` lança `RateLimited` e **nada é gravado**, então o próximo clique tenta de novo.

## Banco (SQLite, `data/fwd.db`)

```sql
mixes  (id TEXT PK, title, note, author, created_at)
tracks (id TEXT PK, mix_id → mixes, position, title, artist, album,
        cover, isrc, duration, links JSON, resolved_at)
cache  (key PK, value JSON, created_at)   -- respostas song.link, token Spotify
```

- IDs curtos aleatórios (`crypto.randomBytes`), alfabeto sem caracteres ambíguos (`0 O 1 l I`): 7 caracteres pro FWD, 10 pra faixa.
- `links` é um JSON `{ spotify?, ytmusic?, youtube?, deezer?, amazon? }`.
- Uma conexão por processo, reaproveitada no hot reload via `globalThis`.

## Segurança

- **Open redirect**: `/go` redireciona pra URLs gravadas no banco. Por isso, todo link (vindo do browser ou de API) passa por `isTrustedLink()`, que exige `https` e o host oficial do serviço (`lib/platforms.ts`).
- **Entrada do browser**: `lib/validate.ts` reconstrói cada faixa campo a campo, com limites de tamanho, ISRC validado por regex e capa só `https`.
- **Limites**: até 500 faixas por FWD, 100 linhas por colagem, título com 120 caracteres, mensagem com 500.
- Capas são carregadas com `referrerPolicy="no-referrer"`.

## Deploy

O SQLite em arquivo exige um servidor com disco persistente (VPS, Fly.io, Railway, Render com volume). **Na Vercel o disco é efêmero**: pra deployar lá, troque `lib/db.ts`/`lib/store.ts` por Turso (libSQL), Supabase ou Postgres. A interface de `store.ts` é pequena de propósito pra essa troca ser simples.
