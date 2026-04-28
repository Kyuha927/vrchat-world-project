using UdonSharp;
using UnityEngine;
using VRC.SDKBase;
using VRC.Udon;

/// <summary>
/// 벨튀 대작전 — 숨는 곳.
/// 플레이어가 트리거 안에 있으면 NPC에게 감지되지 않음.
/// 박스, 쓰레기통, 택배 더미 등에 부착.
/// </summary>
public class HideSpot : UdonSharpBehaviour
{
    [Header("=== 비주얼 ===")]
    public Renderer hideRenderer;
    public Color normalColor = new Color(0.3f, 0.3f, 0.3f);
    public Color activeColor = new Color(0f, 0.83f, 1f, 0.3f); // 숨어있을 때 반투명 파란색

    [Header("=== 사운드 ===")]
    public AudioSource hideAudio;
    public AudioClip hideClip;

    private bool _isOccupied = false;
    private MaterialPropertyBlock _propBlock;

    /// <summary>DoorController에서 참조 — 이 숨는 곳에 플레이어가 있는지</summary>
    public bool IsOccupied => _isOccupied;

    private void Start()
    {
        _propBlock = new MaterialPropertyBlock();
    }

    public override void OnPlayerTriggerEnter(VRCPlayerApi player)
    {
        if (!player.isLocal) return;
        _isOccupied = true;

        if (hideAudio != null && hideClip != null)
        {
            hideAudio.PlayOneShot(hideClip);
        }

        SetHighlight(true);
        Debug.Log("[BellTui] 숨었다!");
    }

    public override void OnPlayerTriggerExit(VRCPlayerApi player)
    {
        if (!player.isLocal) return;
        _isOccupied = false;
        SetHighlight(false);
    }

    private void SetHighlight(bool active)
    {
        if (hideRenderer == null) return;
        hideRenderer.GetPropertyBlock(_propBlock);
        _propBlock.SetColor("_Color", active ? activeColor : normalColor);
        hideRenderer.SetPropertyBlock(_propBlock);
    }
}
