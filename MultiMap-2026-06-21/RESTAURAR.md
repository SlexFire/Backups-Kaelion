# Backup — Arquitetura Multi-Mapas

**Data do backup:** 21/06/2026  
**Repositório:** `Kaelion-Online`  
**Branch de origem:** `main`  
**Base de comparação:** `e22810c` (pré multi-mapas)  
**Commits incluídos (net):** squash de `e22810c` → `0ec52d5`  
**Patch testado:** `git apply --check` em `e22810c` ✅

**Total:** 36 arquivos alterados · +1077 / -192 linhas

---

## Conteúdo desta pasta

| Item | Descrição |
|------|-----------|
| `patches/full.patch` | Diff completo `e22810c..HEAD` — **testado com `git apply --check`** |
| `patches/MultiMap.bundle` | Pacote Git com todos os commits do intervalo |
| `patches/commits/` | Patches individuais por commit (`git format-patch`) |
| `files/` | Cópia espelhada de todos os arquivos finais |
| `files-changed.txt` | Lista com status (A/M) de cada arquivo |
| `commits.txt` | Histórico resumido dos commits |
| `diff-stat.txt` | Estatísticas do diff |

---

## Opção 1 — Restaurar via bundle

```powershell
cd "C:\1- Projetos GitHub\Kaelion-Online"

git fetch "C:\1- Projetos GitHub\Backups-Kaelion\MultiMap-2026-06-21\patches\MultiMap.bundle" HEAD:feature/multimap-restore
git checkout feature/multimap-restore
```

---

## Opção 2 — Aplicar o patch completo (recomendado)

```powershell
cd "C:\1- Projetos GitHub\Kaelion-Online"

git apply --check "C:\1- Projetos GitHub\Backups-Kaelion\MultiMap-2026-06-21\patches\full.patch"
git apply "C:\1- Projetos GitHub\Backups-Kaelion\MultiMap-2026-06-21\patches\full.patch"
```

Conflitos:

```powershell
git apply --3way "C:\1- Projetos GitHub\Backups-Kaelion\MultiMap-2026-06-21\patches\full.patch"
```

---

## Opção 3 — Copiar arquivos manualmente

```powershell
$origem = "C:\1- Projetos GitHub\Backups-Kaelion\MultiMap-2026-06-21\files"
$destino = "C:\1- Projetos GitHub\Kaelion-Online"

Get-ChildItem -Path $origem -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($origem.Length + 1)
    $alvo = Join-Path $destino $rel
    $pasta = Split-Path $alvo -Parent
    if (-not (Test-Path $pasta)) { New-Item -ItemType Directory -Force -Path $pasta | Out-Null }
    Copy-Item $_.FullName $alvo -Force
}
```

Depois: `yarn build` (client) e reinicie o server.

---

## O que este backup inclui

- **MapManager** + `registry.json` (`world`, `mapa_teste`)
- **ChangeMap** packet (cliente ↔ servidor)
- **`player.changeMap()`** e **`switchMap()`** no client
- Comandos **`/maps`** e **`/mapwarp`** (todos os jogadores)
- **Exporter** com registro automático no registry
- Sync de mapas para **`public/data/maps/`** no build (`predev` / `prebuild`)
- Mapa de teste **`mapa_teste`** (48×48) + tileset `tilesheet-1`
- Fixes de WebGL, câmera, grids e nome do jogador ao trocar mapa

---

## Exportar mapa novo

```bash
cd packages/tools
yarn exportmap map/data/mapa_teste.tmj mapa_teste
```

---

## Verificação após restaurar

```powershell
cd packages/common; npx tsc --noEmit
cd ../server; npx tsc --noEmit
cd ../client; npx tsc --noEmit
```

Teste in-game: `/maps` → `/mapwarp mapa_teste`

---

## Nota — merge com Dia/Noite e Clima

Se você também usa o backup `DiaNoiteClima-2026-06-20`, há sobreposição em:

- `commands.ts`, `player.ts`, `world.ts`, `map.ts`
- `connection.ts`, `game.ts`, `handler.ts`, `incoming.ts`, `messages.ts`

Aplique um backup primeiro e depois o outro com `--3way`, ou mesche manualmente.
