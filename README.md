# Backups-Kaelion

Backups versionados de features do [Kaelion-Online](https://github.com/PeresNFT/Kaelion-Online), prontos para restaurar via patch, bundle ou cópia de arquivos.

## Backups disponíveis

| Pasta | Feature | Data |
|-------|---------|------|
| [DiaNoiteClima-2026-06-20](./DiaNoiteClima-2026-06-20/) | Sistema dia/noite + clima | 20/06/2026 |
| [MultiMap-2026-06-21](./MultiMap-2026-06-21/) | Arquitetura multi-mapas | 21/06/2026 |

Cada pasta contém `RESTAURAR.md` com instruções detalhadas.

## Restauração rápida

```powershell
# Ver instruções completas dentro de cada backup:
Get-Content ".\MultiMap-2026-06-21\RESTAURAR.md"
```

## Merge de features

`DiaNoiteClima` e `MultiMap` alteram alguns arquivos em comum. Restaure um backup e aplique o outro com `git apply --3way`, ou mesche manualmente.
