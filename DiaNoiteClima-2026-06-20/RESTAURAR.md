# Backup — Sistema Dia/Noite e Clima (branch `DiaNoiteClima`)

**Data do backup:** 20/06/2026  
**Repositório:** `Kaelion-Online`  
**Branch de origem:** `DiaNoiteClima`  
**Base de comparação:** `main`  
**Commits incluídos:**
- `82be08b` — Sistema de Clima v1.0
- `2b5b86d` — Sistema de Clima v1.1

**Total:** 39 arquivos alterados · +1964 / -16 linhas

---

## Conteúdo desta pasta

| Item | Descrição |
|------|-----------|
| `patches/full.patch` | Diff completo `main...DiaNoiteClima` (inclui binários/ícones) — **testado com `git apply --check` em `main`** |
| `patches/DiaNoiteClima.bundle` | Pacote Git com os 2 commits — **forma mais simples de recriar a branch** |
| `patches/commits/` | Patches individuais por commit (`git format-patch`) |
| `files/` | Cópia espelhada de todos os arquivos finais da branch |
| `files-changed.txt` | Lista com status (A/M) de cada arquivo |
| `commits.txt` | Histórico resumido dos commits |
| `diff-stat.txt` | Estatísticas do diff |

---

## Opção 1 — Restaurar a branch via bundle (mais fácil)

Recria a branch `DiaNoiteClima` com histórico e commits intactos:

```powershell
cd "C:\1- Projetos GitHub\Kaelion-Online"

git fetch "C:\1- Projetos GitHub\Backups-Kaelion\DiaNoiteClima-2026-06-20\patches\DiaNoiteClima.bundle" DiaNoiteClima:DiaNoiteClima
git checkout DiaNoiteClima
```

---

## Opção 2 — Aplicar o patch completo

No diretório raiz do projeto `Kaelion-Online`:

```powershell
cd "C:\1- Projetos GitHub\Kaelion-Online"

# Confira se está na branch desejada (ex.: main)
git status

# Aplicar tudo de uma vez
git apply --check "C:\1- Projetos GitHub\Backups-Kaelion\DiaNoiteClima-2026-06-20\patches\full.patch"
git apply "C:\1- Projetos GitHub\Backups-Kaelion\DiaNoiteClima-2026-06-20\patches\full.patch"
```

Se houver conflito, use:

```powershell
git apply --3way "C:\1- Projetos GitHub\Backups-Kaelion\DiaNoiteClima-2026-06-20\patches\full.patch"
```

---

## Opção 3 — Aplicar commits um a um

```powershell
cd "C:\1- Projetos GitHub\Kaelion-Online"
git am "C:\1- Projetos GitHub\Backups-Kaelion\DiaNoiteClima-2026-06-20\patches\commits\*.patch"
```

Para abortar se algo falhar: `git am --abort`

---

## Opção 4 — Copiar arquivos manualmente

Copie o conteúdo de `files/` para o repositório, mantendo a estrutura de pastas:

```powershell
$origem = "C:\1- Projetos GitHub\Backups-Kaelion\DiaNoiteClima-2026-06-20\files"
$destino = "C:\1- Projetos GitHub\Kaelion-Online"

Get-ChildItem -Path $origem -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($origem.Length + 1)
    $alvo = Join-Path $destino $rel
    $pasta = Split-Path $alvo -Parent
    if (-not (Test-Path $pasta)) { New-Item -ItemType Directory -Force -Path $pasta | Out-Null }
    Copy-Item $_.FullName $alvo -Force
}
```

Depois confira com `git status` e faça commit.

---

## O que este backup inclui

- Ciclo dia/noite (manhã, tarde, entardecer, noite, alta madrugada)
- Climas: chuva, névoa, neve, tempestade
- Interior/exterior (casas, cavernas)
- Comandos admin (`/settime`, `/setweather`, `/clearenv`, etc.)
- Renderização de efeitos no cliente
- HUD de ambiente ao lado da barra de HP
- Ícones Pixel Art em `packages/client/public/img/interface/environment/`
- Scripts auxiliares de ícones em `packages/client/scripts/`

---

## Verificação após restaurar

```powershell
cd packages/common; npx tsc --noEmit
cd ../server; npx tsc --noEmit
cd ../client; npx tsc --noEmit
```

Teste in-game (mapa externo): `/env`, `/settime night`, `/setweather storm`
