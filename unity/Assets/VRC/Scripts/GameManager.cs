using UdonSharp;
using UnityEngine;
using VRC.SDKBase;
using VRC.Udon;

/// <summary>
/// Network-synced game state for BellTui.
/// Mirrors the web version rules: six floors, a 90-second round, combo scoring,
/// notoriety levels, and floor-based difficulty scaling.
/// </summary>
[UdonBehaviourSyncMode(BehaviourSyncMode.Manual)]
public class GameManager : UdonSharpBehaviour
{
    [Header("=== Game Settings ===")]
    public float roundDuration = 90f; // Match the web version 90-second round.
    public int maxNotoriety = 30;

    [Header("=== Floor Difficulty ===")]
    [UdonSynced] public int currentFloor = 0;
    public int maxFloor = 5;
    public float[] floorDifficultyMultipliers = new float[] { 1f, 1.12f, 1.25f, 1.4f, 1.6f, 1.85f };
    public int[] floorBellScoreBase = new int[] { 100, 120, 140, 160, 180, 220 };

    [Header("=== UI References ===")]
    public ScoreBoard scoreBoard;
    public NotorietySystem notorietySystem;

    [Header("=== Audio ===")]
    public AudioSource bgmSource;
    public AudioClip bgmClip;
    public AudioClip gameStartClip;
    public AudioClip gameOverClip;

    [UdonSynced] private bool _gameActive = false;
    [UdonSynced] private float _timeRemaining = 90f;

    private int _localScore = 0;
    private int _localCombo = 0;
    private int _localMaxCombo = 0;
    private int _localBellCount = 0;
    private int _localGoodDeeds = 0;

    public bool IsGameActive => _gameActive;
    public float TimeRemaining => _timeRemaining;
    public int LocalScore => _localScore;
    public int LocalCombo => _localCombo;
    public int CurrentFloor => currentFloor;

    public void StartGame()
    {
        BecomeOwner();

        _gameActive = true;
        _timeRemaining = roundDuration;
        currentFloor = 0;

        _localScore = 0;
        _localCombo = 0;
        _localMaxCombo = 0;
        _localBellCount = 0;
        _localGoodDeeds = 0;

        if (notorietySystem != null) notorietySystem.ResetNotoriety();
        if (scoreBoard != null) scoreBoard.ResetScores();

        RequestSerialization();
        SendCustomNetworkEvent(VRC.Udon.Common.Interfaces.NetworkEventTarget.All, nameof(OnGameStarted));
    }

    public void OnGameStarted()
    {
        if (bgmSource != null && bgmClip != null)
        {
            bgmSource.clip = bgmClip;
            bgmSource.Play();
        }

        if (gameStartClip != null)
        {
            AudioSource.PlayClipAtPoint(gameStartClip, transform.position);
        }

        Debug.Log("[BellTui] Game started.");
    }

    public void EndGame()
    {
        if (!Networking.IsOwner(gameObject)) return;

        _gameActive = false;
        RequestSerialization();

        SendCustomNetworkEvent(VRC.Udon.Common.Interfaces.NetworkEventTarget.All, nameof(OnGameEnded));
    }

    public void OnGameEnded()
    {
        if (bgmSource != null) bgmSource.Stop();

        if (gameOverClip != null)
        {
            AudioSource.PlayClipAtPoint(gameOverClip, transform.position);
        }

        if (scoreBoard != null)
        {
            scoreBoard.ShowFinalResult(_localScore, _localMaxCombo, _localBellCount, _localGoodDeeds);
        }

        Debug.Log($"[BellTui] Game ended. Score:{_localScore} MaxCombo:{_localMaxCombo}");
    }

    public void AddBellScore()
    {
        if (!_gameActive) return;

        _localBellCount++;
        _localCombo++;
        if (_localCombo > _localMaxCombo) _localMaxCombo = _localCombo;

        int points = GetCurrentFloorBaseScore() * _localCombo;
        _localScore += points;

        if (notorietySystem != null)
        {
            notorietySystem.AddNotoriety(1);
        }

        if (scoreBoard != null)
        {
            scoreBoard.UpdateLocalScore(_localScore, _localCombo, _localBellCount);
        }

        Debug.Log($"[BellTui] Bell score +{points} (combo x{_localCombo}, floor {currentFloor + 1})");
    }

    public void ResetCombo()
    {
        _localCombo = 0;
    }

    public void AddGoodDeed(int notorietyReduction)
    {
        if (!_gameActive) return;

        _localGoodDeeds++;

        if (notorietySystem != null)
        {
            notorietySystem.ReduceNotoriety(notorietyReduction);
        }

        if (scoreBoard != null)
        {
            scoreBoard.UpdateGoodDeeds(_localGoodDeeds);
        }

        Debug.Log($"[BellTui] Good deed. Notoriety -{notorietyReduction}");
    }

    public void SetCurrentFloor(int floor)
    {
        BecomeOwner();
        currentFloor = Mathf.Clamp(floor, 0, maxFloor);
        RequestSerialization();
    }

    public float GetCurrentFloorDifficulty()
    {
        return GetFloorDifficulty(currentFloor);
    }

    public float GetFloorDifficulty(int floor)
    {
        int safeFloor = Mathf.Clamp(floor, 0, maxFloor);
        if (floorDifficultyMultipliers == null || floorDifficultyMultipliers.Length == 0)
        {
            return 1f;
        }

        int index = Mathf.Min(safeFloor, floorDifficultyMultipliers.Length - 1);
        return Mathf.Max(1f, floorDifficultyMultipliers[index]);
    }

    public int GetCurrentFloorBaseScore()
    {
        if (floorBellScoreBase == null || floorBellScoreBase.Length == 0)
        {
            return 100;
        }

        int index = Mathf.Min(Mathf.Clamp(currentFloor, 0, maxFloor), floorBellScoreBase.Length - 1);
        return Mathf.Max(100, floorBellScoreBase[index]);
    }

    public int GetCurrentNotorietyLevel()
    {
        if (notorietySystem != null)
        {
            return notorietySystem.NotorietyLevel;
        }

        return 0;
    }

    private void Update()
    {
        if (!_gameActive) return;

        if (Networking.IsOwner(gameObject))
        {
            _timeRemaining -= Time.deltaTime;
            if (_timeRemaining <= 0f)
            {
                _timeRemaining = 0f;
                EndGame();
                return;
            }

            if (Time.frameCount % 600 == 0)
            {
                RequestSerialization();
            }
        }

        if (scoreBoard != null)
        {
            scoreBoard.UpdateTimer(_timeRemaining);
        }
    }

    private void BecomeOwner()
    {
        if (Networking.LocalPlayer != null && !Networking.IsOwner(gameObject))
        {
            Networking.SetOwner(Networking.LocalPlayer, gameObject);
        }
    }
}
