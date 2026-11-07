# API HTTP

Todas as rotas são internas do app (sem autenticação) e respondem JSON, exceto `/go`.

## Tipo `Track`

```ts
{
  title: string;
  artist: string;
  album?: string;
  cover?: string;      // URL https
  isrc?: string;       // 12 caracteres
  duration?: number;   // segundos
  links: {             // ao menos um
    spotify?: string; ytmusic?: string; youtube?: string;
    deezer?: string;  amazon?: string;
  };
}
```

---

## `POST /api/resolve`

Transforma texto colado em faixas. Uma entrada por linha: links ou `artista - música`.

**Body**

```json
{ "input": "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT\nTim Maia - Azul da cor do mar" }
```

**200**

```json
{
  "tracks": [Track, ...],
  "errors": [{ "input": "https://open.spotify.com/playlist/…", "message": "playlist do Spotify ainda não rola…" }]
}
```

Erros por linha não derrubam a requisição. **400** quando `input` está vazio.

---

## `GET /api/search?q=…`

Busca faixas no Deezer (até 12). `q` com menos de 2 caracteres devolve lista vazia.

**200** `{ "tracks": [Track, ...] }` · **502** quando o Deezer falha.

---

## `POST /api/mixes`

Salva um FWD.

**Body**

```json
{
  "secret": "v1.<iv>.<ciphertext>",
  "tracks": [Track, ...]
}
```

- `secret`: assunto, remetente e mensagem **já criptografados no navegador** (`encryptSecret` em `lib/crypto.ts`, AES-256-GCM). O servidor nunca recebe esses campos em texto: `title`/`author`/`note` em texto puro são ignorados, e sem um `secret` válido a resposta é **400**.
- `tracks`: até 500. Faixas sem título ou sem nenhum link confiável são descartadas. Ficam em texto puro, porque o servidor precisa delas para buscar os links.

**201** `{ "id": "yAmoCoy" }` · **400** formato inválido, `secret` ausente ou nenhuma faixa válida.

O link de compartilhar é `/m/<id>#k=<chave>`. A chave (32 bytes, base64url) fica só no fragmento `#`, que o navegador não envia ao servidor.

---

## `GET /m/:id`

Página HTML do FWD. `?novo=1` mostra o banner "link pronto". **404** se não existir.

O HTML vem com o `secret` cifrado; o navegador lê a chave do `#k=…` e descriptografa assunto, remetente e mensagem. Sem a chave (ou com a chave errada) a página mostra as faixas e um aviso de "mensagem trancada". Prévia de link (Open Graph) mostra só a contagem de faixas.

## `GET /go/:trackId/:platform`

`platform` ∈ `spotify | ytmusic | youtube | deezer | amazon`

**307** para o link direto da faixa no serviço, ou para a busca do serviço como fallback. Faixa ou plataforma inválida → **307** para `/`. Detalhes em [ARCHITECTURE.md](ARCHITECTURE.md#resolução-preguiçosa-gotrackidplatform).
