# Nidalii Store — Design System

Base estrutural: o DESIGN.md da Adanola (interface plana, foto dominante, linhas finas, cantos retos).
Mudança deliberada: a voz tipográfica. A Adanola usa só uma sans fina; a Nidalii tem um logo didone
(o "N" de alto contraste) com assinatura cursiva, então os títulos falam em **didone de moda**.

## Ideia central

**"Etiqueta de ateliê."** O site se comporta como a etiqueta costurada numa peça: preto profundo,
papel de algodão, tipografia didone pequena e precisa. O único gesto ousado é o **N do logo**:
um círculo preto que reaparece como marcador de carrinho, cursor do hover das peças e transição
de página. Todo o resto fica quieto para a roupa aparecer.

## Cores

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#0A0A0A` | Texto, botões preenchidos, o círculo N |
| `--paper` | `#F8F7F5` | Fundo do site (off-white frio-neutro, sem amarelar) |
| `--white` | `#FFFFFF` | Fundo de foto de produto, cartões do checkout |
| `--graphite` | `#55524E` | Texto secundário, metadados (contraste 7,6:1 sobre paper) |
| `--line` | `#DDDAD5` | Divisórias, bordas de campo |
| `--wine` | `#7A1E2E` | **Só** preço promocional e erros. Nunca decoração |

A cor vem das fotos. A interface nunca usa gradiente, sombra decorativa ou faixa colorida.

## Tipografia

| Papel | Fonte | Notas |
|---|---|---|
| Display / títulos | **Bodoni Moda** (Google Fonts, variável, eixo `opsz`) | Peso 400–500. `opsz` alto em tamanhos grandes. Itálico só em nomes de coleção |
| Texto / interface | **Jost** (Google Fonts, variável) | Geometria de moda (família Futura). 400 texto, 500 botões |

Escala (razão 1,333, base 16px):

| Token | Tamanho | Uso |
|---|---|---|
| `--fs-xs` | 12px | Legendas de foto, notas legais |
| `--fs-sm` | 14px | Metadados, nome no card |
| `--fs-base` | 16px | Texto corrido, inputs (evita zoom no iOS) |
| `--fs-lg` | 21px | Subtítulos |
| `--fs-xl` | 28px | Título de seção |
| `--fs-2xl` | clamp(36px, 5vw, 50px) | Título de página |
| `--fs-display` | clamp(56px, 11vw, 168px) | Hero |

Regras: sentence case sempre (nada de rótulos em caixa-alta espaçada); entrelinha 1,55 no texto,
1,0–1,05 no display; linhas até ~70 caracteres; preços com algarismos tabulares.

## Forma e espaço

- Base 4px. Interno compacto (8/12/16/24); entre seções, 96–160px no desktop e 64px no mobile.
- Raio: 0 em fotos, cards, tags. 2px em inputs e botões (quase reto, mas sem serrilhar).
  Única forma redonda do sistema: o círculo N (100%).
- Sem sombras. Elevação de gaveta/modal = fundo `--white` + véu `rgba(10,10,10,.4)`.
- Grade: 12 colunas, gutter 16px (mobile) / 24px (desktop), margem 16 / 40px, máximo 1600px.

## Composição

- **Assimetria intencional** na home: foto em 7 colunas + texto deslocado em 4, alternando o lado.
- Catálogo: 2 colunas no mobile, 3 no tablet, 4 no desktop. Fotos em 3:4.
- Página de produto: galeria vertical à esquerda (desktop) / carrossel com deslize (mobile);
  painel de compra fixo à direita.

## Movimento

- Um momento orquestrado: a entrada do hero (o N se abre em máscara circular revelando a foto).
- O resto só responde a ação: hover troca a 2ª foto (crossfade 280ms), gaveta do carrinho
  desliza (320ms, `cubic-bezier(.2,.7,.2,1)`), feedback de "adicionado" no círculo N.
- Só `transform` e `opacity`. `prefers-reduced-motion` desliga máscaras e deslocamentos.

## Proibido

Gradientes, sombras, emojis, numeração decorativa (01/02/03), eyebrows em caixa-alta,
"→" anexado a botões, depoimentos inventados, fotos que não sejam da loja.
