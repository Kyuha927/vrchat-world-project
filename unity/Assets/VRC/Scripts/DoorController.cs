using UdonSharp;
using UnityEngine;
using VRC.SDKBase;
using VRC.Udon;

/// <summary>
/// 벨튀 대작전 — 문 컨트롤러.
/// 벨이 울리면 열리고, 일정 시간 후 주민(NPC)이 반응합니다.
/// 주민이 플레이어를 감지하면 잡힘 처리.
/// </summary>
[UdonBehaviourSyncMode(BehaviourSyncMode.Manual)]
public class DoorController : UdonSharpBehaviour
{
    [Header("=== 연결 ===")]
    public GameManager gameManager;
    public Transform doorPivot; // 문 회전축
    public Transform npcSpawnPoint; // 주민이 나타나는 위치

    [Header("=== 주민 설정 ===")]
    [Tooltip("주민 타입: slow, fast, ghost, alarm, alert, stun, throw")]
    public string neighborType = "slow";
    public float reactionDelay = 2f; // 벨 후 문 열리기까지 시간
    public float detectionRange = 5f; // 주민 감지 거리
    public float openDuration = 4f; // 문이 열려있는 시간
    public float neighborSpeed = 1.5f; // 주민 추적 속도

    [Header("=== 사운드 ===")]
    public AudioSource doorAudio;
    public AudioClip doorOpenClip;
    public AudioClip neighborAngryClip;

    [Header("=== 비주얼 ===")]
    public GameObject npcVisual; // 주민 비주얼 오브젝트
    public Renderer doorFrameRenderer;

    // --- 동기화 ---
    [UdonSynced] private bool _isOpen = false;
    [UdonSynced] private bool _isAngry = false;

    // --- 로컬 상태 ---
    private float _openTimer = 0f;
    private float _reactionTimer = 0f;
    private bool _isRinging = false;
    private bool _bellScored = false; // 이 문에서 점수를 획득했는지
    private float _doorAngle = 0f;
    private Vector3 _npcStartPos;

    public bool IsOpen => _isOpen;

    private void Start()
    {
        if (npcVisual != null) npcVisual.SetActive(false);
        if (npcSpawnPoint != null) _npcStartPos = npcSpawnPoint.position;
    }

    /// <summary>벨 버튼에서 호출 — 문 열기 시퀀스 시작</summary>
    public void OpenDoor()
    {
        if (_isOpen || _isRinging) return;

        _isRinging = true;
        _reactionTimer = reactionDelay;
        _bellScored = false;
    }

    private void Update()
    {
        // 벨이 울린 후 딜레이
        if (_isRinging)
        {
            _reactionTimer -= Time.deltaTime;
            if (_reactionTimer <= 0f)
            {
                _isRinging = false;
                DoOpen();
            }
            return;
        }

        // 문이 열려있을 때
        if (_isOpen && !_isAngry)
        {
            _openTimer -= Time.deltaTime;

            // 플레이어 감지 체크
            VRCPlayerApi local = Networking.LocalPlayer;
            if (local != null && npcSpawnPoint != null)
            {
                float dist = Vector3.Distance(local.GetPosition(), npcSpawnPoint.position);
                if (dist < detectionRange)
                {
                    // 잡혔다! — 주민이 분노 모드
                    SetAngry();
                }
            }

            // 시간 초과 시 = 벨튀 성공!
            if (_openTimer <= 0f)
            {
                CloseDoor();
                if (!_bellScored)
                {
                    _bellScored = true;
                    // 성공적으로 벨튀 달성 (점수는 BellButton에서 이미 추가됨)
                }
            }
        }

        // 분노 모드 — NPC가 플레이어를 추적
        if (_isAngry)
        {
            ChasePlayer();
        }

        // 문 애니메이션
        UpdateDoorAnimation();
    }

    private void DoOpen()
    {
        _isOpen = true;
        _isAngry = false;
        _openTimer = openDuration;

        if (npcVisual != null) npcVisual.SetActive(true);

        if (doorAudio != null && doorOpenClip != null)
        {
            doorAudio.PlayOneShot(doorOpenClip);
        }

        if (Networking.IsOwner(gameObject))
        {
            RequestSerialization();
        }

        // alarm 타입: 주변 문도 열기
        if (neighborType == "alarm")
        {
            // 부모 오브젝트의 다른 DoorController 검색
            DoorController[] siblings = transform.parent != null
                ? transform.parent.GetComponentsInChildren<DoorController>()
                : new DoorController[0];

            foreach (var dc in siblings)
            {
                if (dc != this && !dc.IsOpen)
                {
                    float sibDist = Vector3.Distance(transform.position, dc.transform.position);
                    if (sibDist < 8f) // 8m 이내 이웃
                    {
                        dc.OpenDoor();
                    }
                }
            }
        }
    }

    private void SetAngry()
    {
        _isAngry = true;

        if (neighborAngryClip != null && doorAudio != null)
        {
            doorAudio.PlayOneShot(neighborAngryClip);
        }

        // stun 타입: 잡지 않고 플레이어를 잠시 멈추게 함
        if (neighborType == "stun")
        {
            Debug.Log("[BellTui] 🐱 귀여워서 멈칫!");
            // VRChat에서 플레이어 이동 제한은 제한적 — 시각 효과로 대체
        }
    }

    private void ChasePlayer()
    {
        VRCPlayerApi local = Networking.LocalPlayer;
        if (local == null || npcSpawnPoint == null) return;

        Vector3 playerPos = local.GetPosition();
        Vector3 npcPos = npcSpawnPoint.position;
        float dist = Vector3.Distance(playerPos, npcPos);

        // NPC 추적 이동
        if (dist > 1.5f && dist < detectionRange * 2f)
        {
            Vector3 dir = (playerPos - npcPos).normalized;
            npcSpawnPoint.position += dir * neighborSpeed * Time.deltaTime;

            // NPC가 플레이어를 잡았을 때
            if (dist < 1.5f)
            {
                CatchPlayer();
            }
        }
        else if (dist >= detectionRange * 2f)
        {
            // 너무 멀어지면 포기 — 벨튀 성공!
            CloseDoor();
        }
    }

    private void CatchPlayer()
    {
        if (gameManager != null)
        {
            gameManager.ResetCombo();
        }

        Debug.Log("[BellTui] 😱 잡혔다!");
        CloseDoor();
    }

    public void CloseDoor()
    {
        _isOpen = false;
        _isAngry = false;

        if (npcVisual != null) npcVisual.SetActive(false);
        if (npcSpawnPoint != null) npcSpawnPoint.position = _npcStartPos;

        if (Networking.IsOwner(gameObject))
        {
            RequestSerialization();
        }
    }

    private void UpdateDoorAnimation()
    {
        if (doorPivot == null) return;

        float targetAngle = _isOpen ? -90f : 0f;
        _doorAngle = Mathf.Lerp(_doorAngle, targetAngle, Time.deltaTime * 8f);
        doorPivot.localRotation = Quaternion.Euler(0f, _doorAngle, 0f);
    }
}
