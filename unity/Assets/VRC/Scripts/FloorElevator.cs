using UdonSharp;
using UnityEngine;
using VRC.SDKBase;
using VRC.Udon;

/// <summary>
/// 벨튀 대작전 — 층간 엘리베이터.
/// 플레이어가 Interact하면 다른 층으로 텔레포트.
/// 쿨타임과 이동 애니메이션(문 닫힘→이동→문 열림) 포함.
/// </summary>
public class FloorElevator : UdonSharpBehaviour
{
    [Header("=== 목적지 ===")]
    public Transform destinationPoint; // 도착 위치
    public string destinationName = "2F"; // UI 표시용

    [Header("=== 설정 ===")]
    public float cooldown = 3f;
    public float transitionDuration = 1.5f;

    [Header("=== 비주얼 ===")]
    public Animator doorAnimator; // 엘리베이터 문 애니메이터 (선택)
    public GameObject transitionOverlay; // 전환 화면 (선택)

    [Header("=== 사운드 ===")]
    public AudioSource elevatorAudio;
    public AudioClip elevatorMoveClip;
    public AudioClip elevatorDingClip;

    private float _cooldownTimer = 0f;
    private bool _isTransitioning = false;
    private float _transitionTimer = 0f;

    private void Start()
    {
        if (transitionOverlay != null) transitionOverlay.SetActive(false);
    }

    public override void Interact()
    {
        if (_cooldownTimer > 0f || _isTransitioning) return;
        if (destinationPoint == null) return;

        StartTransition();
    }

    private void StartTransition()
    {
        _isTransitioning = true;
        _transitionTimer = transitionDuration;
        _cooldownTimer = cooldown;

        // 전환 화면 표시
        if (transitionOverlay != null) transitionOverlay.SetActive(true);

        // 문 닫힘 애니메이션
        if (doorAnimator != null) doorAnimator.SetTrigger("Close");

        // 사운드
        if (elevatorAudio != null && elevatorMoveClip != null)
        {
            elevatorAudio.PlayOneShot(elevatorMoveClip);
        }
    }

    private void Update()
    {
        if (_cooldownTimer > 0f)
        {
            _cooldownTimer -= Time.deltaTime;
        }

        if (_isTransitioning)
        {
            _transitionTimer -= Time.deltaTime;

            // 전환 중간 지점에서 텔레포트
            if (_transitionTimer <= transitionDuration * 0.5f && _transitionTimer > transitionDuration * 0.5f - Time.deltaTime)
            {
                TeleportPlayer();
            }

            // 전환 완료
            if (_transitionTimer <= 0f)
            {
                _isTransitioning = false;
                if (transitionOverlay != null) transitionOverlay.SetActive(false);
                if (doorAnimator != null) doorAnimator.SetTrigger("Open");

                // 도착 사운드
                if (elevatorAudio != null && elevatorDingClip != null)
                {
                    elevatorAudio.PlayOneShot(elevatorDingClip);
                }
            }
        }
    }

    private void TeleportPlayer()
    {
        VRCPlayerApi local = Networking.LocalPlayer;
        if (local == null || destinationPoint == null) return;

        local.TeleportTo(
            destinationPoint.position,
            destinationPoint.rotation
        );

        Debug.Log($"[BellTui] 엘리베이터 → {destinationName}");
    }
}
