# fwd.fm · Style Guide

> Uma rádio online de 2003 que recebeu um e-mail encaminhado de 1999 e decidiu ser um app de 2026.

## 1. Conceito

O fwd.fm junta **duas memórias da internet**:

1. **O e-mail encaminhado**: `FW: FW: FW: ouve essa`. Compartilhar sempre foi repassar. Toda a interface é uma mensagem: tem *Assunto*, *De*, *Para*, *Msg* e *[anexos]*.
2. **A rádio online / player de desktop**: equalizador, *on air*, *128kbps*, letreiro rolando, scanlines de monitor CRT.

O resultado é **neon sobre escuro, com estrutura de janela**: nostálgico, mas limpo e legível. Retrô no *tempero*, moderno na *usabilidade*.

### Princípios

| Princípio | Na prática |
| --- | --- |
| **A música é o conteúdo** | Capas e nomes em destaque; a moldura fica no fundo |
| **Metáfora, não fantasia** | O e-mail estrutura a UI, mas os rótulos continuam óbvios ("abrir", "copiar link") |
| **Uma ação por tela** | Compor → `FWD → gerar link`. Receber → `▶ abrir` |
| **Sem marca de terceiros** | Nada de logos de streaming: usamos **siglas** (SP, YM, YT, DZ, AM) com a cor do serviço |
| **Respeita o usuário** | `prefers-reduced-motion` desliga toda animação; contraste AA |

---

## 2. Marca

### Nome

- Sempre **minúsculo**: `fwd.fm`. Nunca "FWD.FM" ou "Fwd.fm".
- O `.fm` faz parte do nome: remete a rádio e a domínio de internet ao mesmo tempo.
- "FWD" em maiúsculas é usado **só como prefixo de assunto**: `FWD: daft punk pra viagem`.

### Logo

```
▮▮▮▮ fwd.fm
```

- **Equalizador** de 4 barras animadas (lima, ciano, pink, lima) + palavra em **VT323**.
- A palavra tem **aberração cromática**: sombra pink deslocada +2px e ciano −2px.
- Favicon (`app/icon.svg`): só as 4 barras em fundo `--bg`, estáticas.
- Espaço mínimo ao redor: a altura do equalizador.

---

## 3. Cores

Todas definidas como tokens em `:root` (`app/globals.css`).

### Base

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#07070c` | Fundo da página (quase preto, levemente azulado) |
| `--panel` | `rgba(16,16,26,.86)` | Janelas, com `backdrop-filter: blur` |
| `--panel-solid` | `#10101a` | Aba ativa, superfícies opacas |
| `--line` | `rgba(255,255,255,.10)` | Divisórias tracejadas |
| `--line-strong` | `rgba(255,255,255,.26)` | Bordas de janela, inputs |
| `--text` | `#f2f0ff` | Texto principal |
| `--muted` | `#8d8aa8` | Rótulos, metadados, dicas |

### Neon (acentos)

| Token | Valor | Papel |
| --- | --- | --- |
| `--lime` | `#c6ff3d` | **Ação primária**, foco, sucesso, "FWD:" |
| `--pink` | `#ff3df2` | Sombra da janela do compositor, mensagem, seleção |
| `--cyan` | `#3df2ff` | Sombra da janela compartilhada, detalhes |
| `--danger` | `#ff6b6b` | Erros |

**Regra:** lima é *a* cor de ação. Pink e ciano são atmosfera e **nunca** aparecem em botões primários.

### Streamings

Usadas **só** em chips, botões "abrir" e siglas, sempre como `--c` (fundo) + `--ink` (texto):

| Serviço | Sigla | `--c` | `--ink` |
| --- | --- | --- | --- |
| Spotify | SP | `#1ed760` | `#04130a` |
| YouTube Music | YM | `#ff5b4f` | `#1a0503` |
| YouTube | YT | `#ff1744` | `#ffffff` |
| Deezer | DZ | `#a64dff` | `#ffffff` |
| Amazon Music | AM | `#25d1da` | `#03181a` |

Definidas em `lib/platforms.ts` e aplicadas com `platformStyle(p)`.

### Fundo

Três camadas, nessa ordem:

1. Brilho radial **pink** no canto superior esquerdo e **ciano** no superior direito
2. **Grade** de 32px com linhas a 3% de branco (papel quadriculado / grid de DAW)
3. **Scanlines** fixas por cima de tudo (`body::after`, linhas de 1px a cada 3px)

---

## 4. Tipografia

| Papel | Fonte | Variável | Onde |
| --- | --- | --- | --- |
| Texto / títulos | **Space Grotesk** | `--font-sans` | Hero, nomes de faixa, corpo |
| Sistema / interface | **JetBrains Mono** | `--font-mono` | Rótulos, botões, barras de janela, metadados, ticker |
| Pixel / display | **VT323** | `--font-pixel` | Logo, números dos passos, 404 |

### Escala

| Elemento | Tamanho | Peso | Detalhe |
| --- | --- | --- | --- |
| Hero `h1` | `clamp(2.3rem, 7vw, 4.4rem)` | 700 | `line-height .98`, `letter-spacing -0.035em` |
| Título do FWD | `clamp(1.5rem, 5vw, 2.2rem)` | 700 | prefixo `FWD:` em mono lima |
| Corpo | 16px | 400 | `line-height 1.5` |
| Lede | 1.05rem | 400 | `--muted`, máx. 60ch |
| Rótulos / botões | 12–13px mono | 600 | |
| Siglas | 10px mono | 700 | |

**Regra:** se é **conteúdo** (música, mensagem do amigo) → sans. Se é **máquina** (rótulo, status, botão, URL) → mono.

---

## 5. Elementos

### Janela

O contêiner principal. Lembra uma janela de sistema operacional antigo, mas **não copia nenhum SO**.

- Borda `1px --line-strong`, raio `4px`
- **Sombra sólida deslocada** `6px 6px 0`, pink (compositor) ou ciano (`.window-cyan`, página compartilhada)
- Barra de título: textura de listras verticais finas, nome do "arquivo" em mono (`nova_mensagem.fwd`, `fwd.fm/m/abc123`) e controles em texto `[–][□][×]` (decorativos)

### Botões

| Tipo | Classe | Aparência |
| --- | --- | --- |
| Primário | `.btn.btn-primary` | Pílula lima, texto preto, borda preta, **sombra dura 3px** |
| Secundário | `.btn` | Pílula transparente, borda `--line-strong` |
| Abrir faixa | `.open-btn` | Pílula na cor do streaming, sombra dura; afunda 2px ao clicar |
| Ícone | `.icon-btn` | 30×30, só caractere (`↑ ↓ ×`) |

Estado ativo: `transform: translate(1–2px)`. O botão "afunda" na sombra.

### Chips de streaming

Pílula com bolinha da sigla. Selecionado (`aria-pressed="true"`): o chip inteiro ganha a cor do serviço e a bolinha inverte.

### Campos estilo e-mail

`Assunto:` / `De:` / `Msg:`: rótulo mono à esquerda, input "nu" (sem borda), linha tracejada embaixo. Campos de colar e buscar usam `.input` (com borda, foco lima com halo).

### Lista de faixas

Grid `nº | capa | título+artista | ação`, divisórias tracejadas. Número com 2 dígitos em mono (`01`, `02`). Capa quadrada; sem imagem → gradiente pink→ciano.

### Movimento

| Animação | Onde | Duração |
| --- | --- | --- |
| Equalizador | Logo | 1.1s loop, barras defasadas |
| Cursor piscando `_` | Kicker do hero | 1s `steps(2)` |
| Ponto "on air" | Topbar | 2s `steps(2)` |
| Letreiro | Ticker da landing | 40s linear |

Tudo é desligado em `prefers-reduced-motion: reduce`.

---

## 6. Layout

- Coluna única, **máx. 820px**, gutter lateral de **16px**
- Mobile-first; breakpoint único em **560px**: some o nº da faixa, o botão "abrir" vira só `▶`, os passos empilham, a barra de compartilhar empilha
- Nada de scroll horizontal: textos longos usam `ellipsis` ou `overflow-wrap: anywhere`

---

## 7. Voz e tom

Português brasileiro, **minúsculo e informal**, como mensagem pra amigo. Curto. Com humor leve de internet.

| ✅ Assim | ❌ Não assim |
| --- | --- |
| `cola um link aí em cima ↑` | `Insira uma URL válida no campo acima.` |
| `puxando...` | `Processando sua solicitação` |
| `playlist do Spotify ainda não rola` | `Erro 400: tipo de recurso não suportado` |
| `esse FWD se perdeu na caixa de spam` | `Página não encontrada` |
| `alguém com bom gosto` (autor vazio) | `Anônimo` |

Regras:

- **Erros dizem o que fazer depois**: "…Cola as faixas, ou a mesma playlist pelo Deezer".
- Vocabulário da casa: **FWD**, **encaminhar**, **anexos**, **puxar**, **on air**.
- Nomes próprios mantêm a grafia oficial: Spotify, YouTube Music, Deezer, Amazon Music.
- Títulos de botão primário levam seta: `FWD → gerar link`, `encaminhar ↗`.

---

## 8. Acessibilidade

- Foco visível: contorno lima de 2px com offset de 2px em tudo
- Abas com `role="tab"` / `aria-selected`; chips com `aria-pressed`
- Botões só com ícone têm `aria-label` ("Subir", "Remover")
- Decorações (equalizador, ticker, capas) têm `aria-hidden` ou `alt=""`
- Texto `--muted` sobre `--bg` passa em AA para tamanhos ≥ 12px mono; não usar `--muted` abaixo de 12px

---

## 9. Checklist para telas novas

- [ ] O conteúdo está dentro de uma `.window` com título de "arquivo"?
- [ ] Só uma ação primária lima?
- [ ] Rótulos de máquina em mono, conteúdo em sans?
- [ ] Cores de streaming só via `platformStyle()`?
- [ ] Funciona em 360px de largura?
- [ ] Animação nova respeita `prefers-reduced-motion`?
- [ ] Textos no tom da casa (minúsculo, curto, com próximo passo)?
