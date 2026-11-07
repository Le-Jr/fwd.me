# Roadmap

## v0.1 (atual): MVP

- [x] Colar links de faixa (Spotify, YouTube, YouTube Music, Deezer)
- [x] Álbuns (Deezer e Spotify) e playlists (Deezer)
- [x] Busca por nome
- [x] Página compartilhável com escolha de streaming lembrada
- [x] Resolução preguiçosa + fallback para busca
- [x] Spotify / song.link opcionais com chave

## Limitações conhecidas

| Limitação | Por quê | Saída |
| --- | --- | --- |
| Spotify, YouTube Music e Amazon abrem a **busca** em vez da faixa exata (sem chaves) | Não há API aberta e sem chave pra isso | Configurar `SPOTIFY_CLIENT_*`; YouTube Data API; chave do song.link |
| Playlist do **Spotify** não importa | Ler playlist exige a Web API, com regras mais restritas pra apps novos | Integrar a Web API com OAuth do usuário |
| Playlist do **YouTube** não importa | Exige YouTube Data API (chave + cota) | Integrar com `YOUTUBE_API_KEY` |
| Link da **Amazon** não é lido | A página não expõe metadados sem JavaScript | Busca pelo nome; investigar API da Amazon |
| Match às vezes erra versões (ao vivo, remaster) | Match por texto no Deezer | Preferir ISRC quando a origem tiver; mostrar "não é essa?" |

## Próximos passos

### v0.2: links diretos e qualidade

- [ ] YouTube Music: link direto via YouTube Data API (busca `artista título`)
- [ ] Importar playlist do Spotify e do YouTube (com chaves)
- [ ] Botão "não é essa faixa?" na página pra corrigir o match
- [ ] Imagem de Open Graph gerada (`opengraph-image.tsx`) com a capa em mosaico e "FWD: título"
- [ ] Rate limit por IP nas rotas `/api/*`

### v0.3: social

- [ ] "Salvar como playlist no meu Spotify / YouTube / Deezer" (OAuth de quem recebe)
- [ ] Reações por faixa (🔥 / 💀) sem login
- [ ] Contador de "encaminhamentos": cada reenvio vira `FW: FW:` no título
- [ ] Editar o FWD depois de criado (link secreto de edição)

### Infra

- [x] Banco no Turso (libSQL) pra rodar na Vercel
- [ ] Primeiro deploy na Vercel
- [ ] Domínio próprio
- [x] Testes unitários (Vitest) de `parseYoutubeTitle`, `cleanTrack`, `isTrustedLink`, helpers de abertura de app e formatação
- [x] CI/CD no GitHub Actions com deploy na Vercel (preview na `dev`, produção na `main`)
- [ ] Testes de integração das rotas `/api/*` com banco em memória
