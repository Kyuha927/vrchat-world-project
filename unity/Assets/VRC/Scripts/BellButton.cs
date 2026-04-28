using UdonSharp;
using UnityEngine;
using VRC.SDKBase;
using VRC.Udon;

/// <summary>
/// 벨튀 대작전 — 초인종 버튼.
/// 플레이어가 Interact하면 벨 사운드 + 연결된 문 열기 + 점수 추가.
/// </summary>
[UdonBehaviourSyncMode(BehaviourSyncMode.Manual)]
public class BellButton : UdonSharpBehaviour
{
    [Header("=== 연결 ===")]
    public DoorController door;
    public GameManager gameManager;

    [Header("=== 사운드 ===")]
    public AudioSource bellAudio;
    public AudioClip bellClip;

    [Header("=== 비주얼 ===")]
    public Renderer buttonRenderer;
    public Color normalColor = new Color(0.3f, 0.3f, 0.3f);
    public Color activeColor = new Color(0.91f, 0.27f, 0.37f); // #E94560
    public float glowDuration = 0.5f;

    [Header("=== 설정 ===")]
    public float cooldown = 2f;

    [UdonSynced] private bool _isRinging = false;
    private float _cooldownTimer = 0f;
    private float _glowTimer = 0f;
    private MaterialPropertyBlock _propBlock;

    private void Start()
    {
        _propBlock = new MaterialPropertyBlock();
        SetButtonColor(normalColor);
    }

    public override void Interact()
    {
        if (!CanRing()) return;

        // 오너쉽 확보 후 동기화
        Networking.SetOwner(Networking.LocalPlayer, gameObject);
        _isRinging = true;
        RequestSerialization();

        // 로컬 즉시 실행 (레이턴시 보상)
        RingBell();

        // 네트워크 이벤트로 다른 플레이어에게도 전달
        SendCustomNetworkEvent(VRC.Udon.Common.Interfaces.NetworkEventTarget.All, nameof(OnBellRing));
    }

    public void OnBellRing()
    {
        // 모든 클라이언트에서 실행
        if (bellAudio != null && bellClip != null)
        {
            bellAudio.PlayOneShot(bellClip);
        }

        // 문 열기
        if (door != null)
        {
            door.OpenDoor();
        }

        // 버튼 글로우 이펙트
        _glowTimer = glowDuration;
        SetButtonColor(activeColor);
    }

    private void RingBell()
    {
        _cooldownTimer = cooldown;

        // 게임 매니저에 점수 추가 (로컬 플레이어만)
        if (gameManager != null && gameManager.IsGameActive)
        {
            gameManager.AddBellScore();
        }
    }

    private bool CanRing()
    {
        if (_cooldownTimer > 0f) return false;
        if (gameManager != null && !gameManager.IsGameActive) return false;
        if (door != null && door.IsOpen) return false;
        return true;
    }

    private void Update()
    {
        // 쿨타임 처리
        if (_cooldownTimer > 0f)
        {
            _cooldownTimer -= Time.deltaTime;
        }

        // 글로우 페이드
        if (_glowTimer > 0f)
        {
            _glowTimer -= Time.deltaTime;
            float t = _glowTimer / glowDuration;
            SetButtonColor(Color.Lerp(normalColor, activeColor, t));

            if (_glowTimer <= 0f)
            {
                _isRinging = false;
                RequestSerialization();
            }
        }
    }

    private void SetButtonColor(Color color)
    {
        if (buttonRenderer == null) return;
        buttonRenderer.GetPropertyBlock(_propBlock);
        _propBlock.SetColor("_Color", color);
        _propBlock.SetColor("_EmissionColor", color * 2f);
        buttonRenderer.SetPropertyBlock(_propBlock);
    }
}
