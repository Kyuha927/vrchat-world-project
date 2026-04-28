using UdonSharp;
using UnityEngine;
using VRC.SDKBase;
using VRC.Udon;

/// <summary>
/// 벨튀 대작전 — 전체 게임 상태를 관리하는 싱글톤 매니저.
/// 점수, 콤보, 악명, 선행, 라운드 타이머를 네트워크 동기화합니다.
/// </summary>
[UdonBehaviourSyncMode(BehaviourSyncMode.Manual)]
public class GameManager : UdonSharpBehaviour
{
    [Header("=== 게임 설정 ===")]
    public float roundDuration = 180f; // 3분 라운드
    public int maxNotoriety = 30;

    [Header("=== UI 참조 ===")]
    public ScoreBoard scoreBoard;
    public NotorietySystem notorietySystem;

    [Header("=== 사운드 ===")]
    public AudioSource bgmSource;
    public AudioClip bgmClip;
    public AudioClip gameStartClip;
    public AudioClip gameOverClip;

    // --- 동기화 변수 ---
    [UdonSynced] private bool _gameActive = false;
    [UdonSynced] private float _timeRemaining = 180f;

    // 로컬 플레이어 스탯 (각 플레이어 독립)
    private int _localScore = 0;
    private int _localCombo = 0;
    private int _localMaxCombo = 0;
    private int _localBellCount = 0;
    private int _localGoodDeeds = 0;

    // 상태
    private bool _isOwnerTicking = false;

    // === 프로퍼티 ===
    public bool IsGameActive => _gameActive;
    public float TimeRemaining => _timeRemaining;
    public int LocalScore => _localScore;
    public int LocalCombo => _localCombo;

    // === 게임 시작 ===
    public void StartGame()
    {
        if (!Networking.IsOwner(gameObject))
        {
            Networking.SetOwner(Networking.LocalPlayer, gameObject);
        }

        _gameActive = true;
        _timeRemaining = roundDuration;
        RequestSerialization();

        // 로컬 초기화
        _localScore = 0;
        _localCombo = 0;
        _localMaxCombo = 0;
        _localBellCount = 0;
        _localGoodDeeds = 0;

        if (scoreBoard != null) scoreBoard.ResetScores();

        SendCustomNetworkEvent(VRC.Udon.Common.Interfaces.NetworkEventTarget.All, nameof(OnGameStarted));
    }

    public void OnGameStarted()
    {
        // 각 클라이언트에서 실행
        if (bgmSource != null && bgmClip != null)
        {
            bgmSource.clip = bgmClip;
            bgmSource.Play();
        }

        if (gameStartClip != null)
        {
            AudioSource.PlayClipAtPoint(gameStartClip, transform.position);
        }

        Debug.Log("[BellTui] 게임 시작!");
    }

    // === 게임 종료 ===
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

        // 스코어보드에 최종 결과 표시
        if (scoreBoard != null)
        {
            scoreBoard.ShowFinalResult(_localScore, _localMaxCombo, _localBellCount, _localGoodDeeds);
        }

        Debug.Log($"[BellTui] 게임 종료! 점수:{_localScore} 최고콤보:{_localMaxCombo}");
    }

    // === 점수 추가 (벨튀 성공 시 호출) ===
    public void AddBellScore()
    {
        if (!_gameActive) return;

        _localBellCount++;
        _localCombo++;
        if (_localCombo > _localMaxCombo) _localMaxCombo = _localCombo;

        int points = 100 * _localCombo;
        _localScore += points;

        // 악명 증가
        if (notorietySystem != null)
        {
            notorietySystem.AddNotoriety(1);
        }

        // UI 업데이트
        if (scoreBoard != null)
        {
            scoreBoard.UpdateLocalScore(_localScore, _localCombo, _localBellCount);
        }

        Debug.Log($"[BellTui] 벨튀! +{points} (콤보 x{_localCombo})");
    }

    // === 콤보 리셋 (잡혔을 때) ===
    public void ResetCombo()
    {
        _localCombo = 0;
    }

    // === 선행 추가 ===
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

        Debug.Log($"[BellTui] 선행! 악명 -{notorietyReduction}");
    }

    // === 타이머 (오너만 틱) ===
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

            // 10초마다 동기화 (부하 최소화)
            if (Time.frameCount % 600 == 0)
            {
                RequestSerialization();
            }
        }

        // UI 타이머 업데이트
        if (scoreBoard != null)
        {
            scoreBoard.UpdateTimer(_timeRemaining);
        }
    }
}
