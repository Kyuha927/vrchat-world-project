# NVIDIA Build Translation Kit

Portable scripts for using NVIDIA Build / NIM chat completions from another device.

## Secret rule

The real API key is **not** committed to git. Set it locally on each device:

```powershell
$env:NVIDIA_API_KEY = "nvapi-..."
```

or persist it on Windows:

```powershell
.\setup_env.ps1
```

Linux/macOS:

```bash
export NVIDIA_API_KEY='nvapi-...'
```

## Quick check

```powershell
python .\scripts\check_nvidia_build.py
```

Expected: JSON showing `ok: true` and the configured model.

## Data layout

Put source text files here:

```text
data/raw/
```

Known work names:

- `dungeon_streamer` -> `dungeon_streamer_raw_all.txt`
- `jijibaba` -> `jijibaba_raw_all.txt`
- `nobody_knows` -> `nobody_knows_raw_all.txt`

## Translate one chapter

```powershell
python .\scripts\translate_chapter_nvidia.py status --work jijibaba
python .\scripts\translate_chapter_nvidia.py translate --work jijibaba --chapter 1
```

Outputs:

```text
data/chapters/
data/chapter_state.json
```

## Translate whole raw files

```powershell
python .\scripts\translate_novel_nvidia.py
```

Outputs:

```text
data/translated/
```

## Override model

```powershell
$env:NVIDIA_MODEL = "qwen/qwen3-coder-480b-a35b-instruct"
```

Default model:

```text
qwen/qwen3.5-397b-a17b
```
