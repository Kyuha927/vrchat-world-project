using UdonSharp;
using UnityEngine;
using UnityEngine.UI;
using VRC.SDKBase;
using VRC.Udon;

/// <summary>
/// 벨튀 대작전 — 악명(Notoriety) 시스템.
/// 벨을 누를 때마다 악명 증가, 선행 시 감소.
/// 레벨에 따라 감시 시스템(드론, CCTV) 활성화.
/// </summary>
public class NotorietySystem : UdonSharpBehaviour
{
    [Header("=== UI ===")]
    public Text notorietyText;
    public Image notorietyBar;

    [Header("=== 감시 시스템 ===")]
    [Tooltip("악명 레벨 2 이상 활성화")]
    public GameObject[] dronesLevel2;
    [Tooltip("악명 레벨 3 이상 활성화")]
    public GameObject[] dronesLevel3;
    [Tooltip("악명 레벨 4 이상 활성화")]
    public GameObject[] alarmSystemLevel4;

    [Header("=== 설정 ===")]
    public int maxNotoriety = 30;

    private int _notoriety = 0;
    private readonly string[] _levelNames = {
        "장난꾸러기", "골칫덩이", "지명수배", "도시의 적", "공공의 적"
    };

    public int Notoriety => _notoriety;
    public int NotorietyLevel => Mathf.Min(4, _notoriety / 6);

    private void Start()
    {
        UpdateUI();
        SetSurveillance(0);
    }

    public void AddNotoriety(int amount)
    {
        _notoriety = Mathf.Min(maxNotoriety, _notoriety + amount);
        UpdateUI();
        UpdateSurveillance();
    }

    public void ReduceNotoriety(int amount)
    {
        _notoriety = Mathf.Max(0, _notoriety - amount);
        UpdateUI();
        UpdateSurveillance();
    }

    public void ResetNotoriety()
    {
        _notoriety = 0;
        UpdateUI();
        SetSurveillance(0);
    }

    private void UpdateUI()
    {
        int level = NotorietyLevel;

        if (notorietyText != null)
        {
            string stars = new string('★', level + 1) + new string('☆', 4 - level);
            notorietyText.text = $"⚡ {stars} {_levelNames[level]}";

            // 색상: 레벨에 따라 변경
            notorietyText.color = level >= 3
                ? new Color(0.91f, 0.27f, 0.37f) // red
                : level >= 2
                    ? new Color(0.66f, 0.33f, 0.97f) // purple
                    : new Color(0.6f, 0.6f, 0.6f); // gray
        }

        if (notorietyBar != null)
        {
            notorietyBar.fillAmount = (float)_notoriety / maxNotoriety;
        }
    }

    private void UpdateSurveillance()
    {
        SetSurveillance(NotorietyLevel);
    }

    private void SetSurveillance(int level)
    {
        // 레벨 2+: 드론 순찰 시작
        if (dronesLevel2 != null)
        {
            foreach (var drone in dronesLevel2)
            {
                if (drone != null) drone.SetActive(level >= 2);
            }
        }

        // 레벨 3+: 추가 드론
        if (dronesLevel3 != null)
        {
            foreach (var drone in dronesLevel3)
            {
                if (drone != null) drone.SetActive(level >= 3);
            }
        }

        // 레벨 4+: 경보 시스템
        if (alarmSystemLevel4 != null)
        {
            foreach (var alarm in alarmSystemLevel4)
            {
                if (alarm != null) alarm.SetActive(level >= 4);
            }
        }
    }
}
