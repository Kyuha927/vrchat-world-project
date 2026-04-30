param(
    [string]$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

function Assert-Contains {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Message
    )

    $text = Get-Content -LiteralPath $Path -Raw
    if ($text -notmatch $Pattern) {
        throw "$Message`nMissing pattern: $Pattern`nFile: $Path"
    }
}

$serverIndex = Join-Path $RepoRoot 'web-belltui/server/index.js'
$gameJs = Join-Path $RepoRoot 'web-belltui/game.js'
$characterSelectJs = Join-Path $RepoRoot 'web-belltui/character-select.js'
$gameManager = Join-Path $RepoRoot 'unity/Assets/VRC/Scripts/GameManager.cs'
$doorController = Join-Path $RepoRoot 'unity/Assets/VRC/Scripts/DoorController.cs'

Write-Host 'Checking Node syntax...'
node --check $serverIndex | Out-Null
node --check $gameJs | Out-Null
node --check $characterSelectJs | Out-Null

Write-Host 'Checking mobile web start flow...'
Assert-Contains $characterSelectJs 'async\s+function\s+initCharacterProfiles\s*\(' 'Character profiles must be initialized before mobile solo start.'
Assert-Contains $characterSelectJs "document\.addEventListener\('DOMContentLoaded',\s*initCharacterProfiles\)" 'Character profile initialization must run on DOMContentLoaded.'
Assert-Contains $characterSelectJs '<span class="stat-label">Stealth</span>' 'Character card markup must not contain malformed stat-label HTML.'
Assert-Contains $characterSelectJs "document\.body\.classList\.add\('game-active'\)" 'Mobile touch pad must only activate after the game starts.'
Assert-Contains $gameJs 'body\.game-active\s+#touch-pad' 'Mobile touch pad CSS must be gated behind body.game-active.'
Assert-Contains $gameJs 'this\.lastTimerAt\s*=\s*performance\.now\(\)' 'Web 90-second timer must use real elapsed time.'
Assert-Contains $gameJs 'this\.timer\s*-=\s*dt' 'Web timer must decrement by elapsed seconds, not frame count.'

$styleCss = Join-Path $RepoRoot 'web-belltui/style.css'
Assert-Contains $styleCss '#charselect\{[^}]*overflow-y:auto' 'Character select must scroll on mobile screens.'
Assert-Contains $styleCss '\.charselect-actions\{[^}]*order:1' 'Character select action buttons must be ordered above the long card list on mobile.'

Write-Host 'Checking Windows handover Unity parity markers...'
Assert-Contains $gameManager 'public\s+float\s+roundDuration\s*=\s*90f\s*;' 'GameManager must default to the web version 90-second timer.'
Assert-Contains $gameManager '\[UdonSynced\]\s+private\s+float\s+_timeRemaining\s*=\s*90f\s*;' 'GameManager synced timer must start at 90 seconds.'
Assert-Contains $gameManager 'public\s+int\s+currentFloor\s*=\s*0\s*;' 'GameManager must track the current 0-based floor.'
Assert-Contains $gameManager 'public\s+int\s+maxFloor\s*=\s*5\s*;' 'GameManager must model the six-floor web layout.'
Assert-Contains $gameManager 'floorDifficultyMultipliers' 'GameManager must expose floor difficulty multipliers.'
Assert-Contains $gameManager 'SetCurrentFloor\s*\(' 'GameManager must provide floor-change API for elevators.'
Assert-Contains $gameManager 'GetCurrentFloorDifficulty\s*\(' 'GameManager must expose current floor difficulty.'
Assert-Contains $gameManager 'GetCurrentNotorietyLevel\s*\(' 'GameManager must expose web-style notoriety levels.'

Assert-Contains $doorController 'public\s+int\s+floorIndex\s*=\s*0\s*;' 'DoorController must know its floor for per-floor difficulty.'
Assert-Contains $doorController 'public\s+float\s+baseReactionDelay' 'DoorController must preserve base reaction delay before scaling.'
Assert-Contains $doorController 'ApplyFloorDifficulty\s*\(' 'DoorController must apply GameManager floor difficulty.'
Assert-Contains $doorController 'reactionDelay\s*=\s*Mathf\.Max\(0\.35f,\s*baseReactionDelay\s*/\s*difficultyMultiplier\)' 'Door reaction delay must tighten as floors get harder.'

Write-Host 'OK: Windows handover checks passed.'
