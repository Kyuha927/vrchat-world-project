using UdonSharp;
using UnityEngine;
using UnityEngine.UI;
using VRC.SDKBase;
using VRC.Udon;

/// <summary>
/// 벨튀 대작전 — 스코어보드 UI.
/// Canvas에 실시간 점수, 타이머, 콤보, 악명 표시.
/// 로비와 옥상에 배치.
/// </summary>
public class ScoreBoard : UdonSharpBehaviour
{
    [Header("=== UI 요소 ===")]
    public Text scoreText;
    public Text comboText;
    public Text timerText;
    public Text bellCountText;
    public Text goodDeedsText;
    public Text playerNameText;

    [Header("=== 결과 화면 ===")]
    public GameObject resultPanel;
    public Text resultScoreText;
    public Text resultComboText;
    public Text resultBellsText;
    public Text resultGoodDeedsText;
    public Text resultEndingText;

    private void Start()
    {
        if (resultPanel != null) resultPanel.SetActive(false);

        // 플레이어 이름 표시
        VRCPlayerApi local = Networking.LocalPlayer;
        if (local != null && playerNameText != null)
        {
            playerNameText.text = local.displayName;
        }
    }

    public void UpdateLocalScore(int score, int combo, int bellCount)
    {
        if (scoreText != null) scoreText.text = score.ToString();
        if (comboText != null)
        {
            comboText.text = combo > 1 ? $"x{combo} COMBO!" : "";
            comboText.color = combo > 3
                ? new Color(1f, 0.82f, 0.4f) // gold
                : new Color(0.5f, 1f, 0.5f);  // green
        }
        if (bellCountText != null) bellCountText.text = $"🔔 {bellCount}";
    }

    public void UpdateTimer(float timeRemaining)
    {
        if (timerText == null) return;
        int min = Mathf.FloorToInt(timeRemaining / 60f);
        int sec = Mathf.FloorToInt(timeRemaining % 60f);
        timerText.text = $"{min}:{sec:00}";

        // 30초 이하일 때 빨간색
        timerText.color = timeRemaining < 30f
            ? new Color(0.91f, 0.27f, 0.37f)
            : Color.white;
    }

    public void UpdateGoodDeeds(int count)
    {
        if (goodDeedsText != null) goodDeedsText.text = $"😇 {count}";
    }

    public void ResetScores()
    {
        if (scoreText != null) scoreText.text = "0";
        if (comboText != null) comboText.text = "";
        if (bellCountText != null) bellCountText.text = "🔔 0";
        if (goodDeedsText != null) goodDeedsText.text = "😇 0";
        if (resultPanel != null) resultPanel.SetActive(false);
    }

    public void ShowFinalResult(int score, int maxCombo, int bellCount, int goodDeeds)
    {
        if (resultPanel != null) resultPanel.SetActive(true);
        if (resultScoreText != null) resultScoreText.text = score.ToString();
        if (resultComboText != null) resultComboText.text = $"최고 콤보: x{maxCombo}";
        if (resultBellsText != null) resultBellsText.text = $"벨튀 횟수: {bellCount}";
        if (resultGoodDeedsText != null) resultGoodDeedsText.text = $"선행: {goodDeeds}회";

        // 엔딩 결정
        if (resultEndingText != null)
        {
            if (goodDeeds >= 5)
            {
                resultEndingText.text = "🌟 선행 엔딩: 빌런인 줄 알았더니 동네 히어로!";
                resultEndingText.color = new Color(0f, 0.83f, 1f);
            }
            else if (bellCount >= 15)
            {
                resultEndingText.text = "🔥 공공의 적: 도시가 당신을 두려워한다!";
                resultEndingText.color = new Color(0.91f, 0.27f, 0.37f);
            }
            else
            {
                resultEndingText.text = "\"또 왔네 저 애\" — 동네 허당 빌런";
                resultEndingText.color = new Color(0.66f, 0.33f, 0.97f);
            }
        }
    }
}
