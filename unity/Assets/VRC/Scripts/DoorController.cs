using UdonSharp;
using UnityEngine;
using VRC.SDKBase;
using VRC.Udon;

/// <summary>
/// Door/NPC controller for BellTui.
/// The door reacts faster and stays risky for less time on harder floors,
/// matching the web version's floor-based difficulty curve.
/// </summary>
[UdonBehaviourSyncMode(BehaviourSyncMode.Manual)]
public class DoorController : UdonSharpBehaviour
{
    [Header("=== References ===")]
    public GameManager gameManager;
    public Transform doorPivot;
    public Transform npcSpawnPoint;

    [Header("=== Neighbor Settings ===")]
    [Tooltip("Neighbor type: slow, fast, ghost, alarm, alert, stun, throw")]
    public string neighborType = "slow";
    public int floorIndex = 0;
    public float baseReactionDelay = 2f;
    public float reactionDelay = 2f;
    public float baseDetectionRange = 5f;
    public float detectionRange = 5f;
    public float baseOpenDuration = 4f;
    public float openDuration = 4f;
    public float baseNeighborSpeed = 1.5f;
    public float neighborSpeed = 1.5f;
    public float difficultyMultiplier = 1f;

    [Header("=== Audio ===")]
    public AudioSource doorAudio;
    public AudioClip doorOpenClip;
    public AudioClip neighborAngryClip;

    [Header("=== Visuals ===")]
    public GameObject npcVisual;
    public Renderer doorFrameRenderer;

    [UdonSynced] private bool _isOpen = false;
    [UdonSynced] private bool _isAngry = false;

    private float _openTimer = 0f;
    private float _reactionTimer = 0f;
    private bool _isRinging = false;
    private bool _bellScored = false;
    private float _doorAngle = 0f;
    private Vector3 _npcStartPos;

    public bool IsOpen => _isOpen;

    private void Start()
    {
        if (npcVisual != null) npcVisual.SetActive(false);
        if (npcSpawnPoint != null) _npcStartPos = npcSpawnPoint.position;
        ApplyFloorDifficulty();
    }

    public void OpenDoor()
    {
        if (_isOpen || _isRinging) return;

        ApplyFloorDifficulty();

        _isRinging = true;
        _reactionTimer = reactionDelay;
        _bellScored = false;
    }

    public void ApplyFloorDifficulty()
    {
        if (gameManager != null)
        {
            difficultyMultiplier = gameManager.GetFloorDifficulty(floorIndex);
        }
        else
        {
            difficultyMultiplier = Mathf.Max(1f, difficultyMultiplier);
        }

        reactionDelay = Mathf.Max(0.35f, baseReactionDelay / difficultyMultiplier);
        openDuration = Mathf.Max(1.25f, baseOpenDuration / Mathf.Sqrt(difficultyMultiplier));
        detectionRange = Mathf.Max(2f, baseDetectionRange + ((difficultyMultiplier - 1f) * 1.5f));
        neighborSpeed = Mathf.Max(0.5f, baseNeighborSpeed * difficultyMultiplier);

        ApplyNeighborTrait();
    }

    private void Update()
    {
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

        if (_isOpen && !_isAngry)
        {
            _openTimer -= Time.deltaTime;

            VRCPlayerApi local = Networking.LocalPlayer;
            if (local != null && npcSpawnPoint != null)
            {
                float dist = Vector3.Distance(local.GetPosition(), npcSpawnPoint.position);
                if (dist < detectionRange)
                {
                    SetAngry();
                }
            }

            if (_openTimer <= 0f)
            {
                CloseDoor();
                if (!_bellScored)
                {
                    _bellScored = true;
                }
            }
        }

        if (_isAngry)
        {
            ChasePlayer();
        }

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

        if (neighborType == "alarm")
        {
            OpenNearbyDoors();
        }
    }

    private void OpenNearbyDoors()
    {
        DoorController[] siblings = transform.parent != null
            ? transform.parent.GetComponentsInChildren<DoorController>()
            : new DoorController[0];

        foreach (DoorController dc in siblings)
        {
            if (dc != null && dc != this && !dc.IsOpen)
            {
                float sibDist = Vector3.Distance(transform.position, dc.transform.position);
                if (sibDist < 8f)
                {
                    dc.OpenDoor();
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

        if (neighborType == "stun")
        {
            Debug.Log("[BellTui] Stun neighbor triggered.");
        }
    }

    private void ChasePlayer()
    {
        VRCPlayerApi local = Networking.LocalPlayer;
        if (local == null || npcSpawnPoint == null) return;

        Vector3 playerPos = local.GetPosition();
        Vector3 npcPos = npcSpawnPoint.position;
        float dist = Vector3.Distance(playerPos, npcPos);

        if (dist <= 1.5f)
        {
            CatchPlayer();
            return;
        }

        if (dist < detectionRange * 2f)
        {
            Vector3 dir = (playerPos - npcPos).normalized;
            npcSpawnPoint.position += dir * neighborSpeed * Time.deltaTime;
        }
        else
        {
            CloseDoor();
        }
    }

    private void CatchPlayer()
    {
        if (gameManager != null)
        {
            gameManager.ResetCombo();
        }

        Debug.Log("[BellTui] Player caught.");
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

    private void ApplyNeighborTrait()
    {
        if (neighborType == "fast")
        {
            neighborSpeed *= 1.35f;
            reactionDelay *= 0.9f;
        }
        else if (neighborType == "far")
        {
            detectionRange += 3f;
        }
        else if (neighborType == "ghost")
        {
            reactionDelay *= 0.8f;
        }
        else if (neighborType == "alert")
        {
            detectionRange += 1.5f;
            neighborSpeed *= 1.15f;
        }
        else if (neighborType == "throw")
        {
            detectionRange += 2f;
            reactionDelay *= 0.85f;
        }
    }
}
