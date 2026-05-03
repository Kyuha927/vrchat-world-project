using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;

/// <summary>
/// 벨튀 대작전 — 라이트맵 자동 베이크.
/// Unity 메뉴 [VRC BellTui] → Bake Lightmaps 또는
/// batchmode: -executeMethod BellTuiBaker.AutoBake
/// Quest 최적화: 저해상도 라이트맵, 단순 설정.
/// </summary>
public class BellTuiBaker : Editor
{
    [MenuItem("VRC BellTui/💡 Bake Lightmaps")]
    static void BakeLightmaps()
    {
        ConfigureAndBake();
    }

    /// <summary>
    /// batchmode용 진입점: -executeMethod BellTuiBaker.AutoBake
    /// </summary>
    static void AutoBake()
    {
        Debug.Log("[BellTui/AutoBake] 배치 모드 라이트맵 베이크 시작");

        // 씬 열기
        var scenePath = "Assets/VRC/Scenes/BellTui_World.unity";
        if (System.IO.File.Exists(System.IO.Path.Combine(Application.dataPath, "..", scenePath)))
        {
            EditorSceneManager.OpenScene(scenePath);
        }

        ConfigureAndBake();

        // 씬 저장
        EditorSceneManager.SaveScene(SceneManager.GetActiveScene());
        Debug.Log("[BellTui/AutoBake] 베이크 + 저장 완료");
    }

    static void ConfigureAndBake()
    {
        Debug.Log("[BellTui] ═══ 라이트맵 베이크 설정 ═══");

        // === Quest 최적화 라이트맵 설정 ===
        // Lightmap 해상도: 낮게 (Quest GPU 부담 최소화)
        LightmapEditorSettings.bakeResolution = 10;      // texels per unit
        LightmapEditorSettings.padding = 2;
        LightmapEditorSettings.maxAtlasSize = 512;       // 1024 대신 512 (Quest용)
        LightmapEditorSettings.textureCompression = true;

        // 반사 바운스 최소화
        LightmapEditorSettings.bounces = 1;

        // Lightmapper: Progressive GPU (빠름)
        LightmapEditorSettings.lightmapper = LightmapEditorSettings.Lightmapper.ProgressiveGPU;

        // 환경 조명
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(0.05f, 0.05f, 0.1f);

        // 모든 Static 오브젝트에 Contribute GI 플래그 확인
        var allRenderers = Object.FindObjectsOfType<MeshRenderer>();
        int staticCount = 0;
        foreach (var r in allRenderers)
        {
            if (r.gameObject.isStatic)
            {
                // Lightmap Static 확인
                var flags = GameObjectUtility.GetStaticEditorFlags(r.gameObject);
                if ((flags & StaticEditorFlags.ContributeGI) == 0)
                {
                    flags |= StaticEditorFlags.ContributeGI;
                    GameObjectUtility.SetStaticEditorFlags(r.gameObject, flags);
                }
                staticCount++;
            }
        }

        Debug.Log($"[BellTui] Static 오브젝트: {staticCount}개");
        Debug.Log("[BellTui] 라이트맵 설정: 512px 아틀라스, 1 바운스, Progressive GPU");

        // 베이크 시작
        Debug.Log("[BellTui] 🔥 베이크 시작...");
        Lightmapping.Bake();
        Debug.Log("[BellTui] ✅ 라이트맵 베이크 완료!");

        // 결과 확인
        var lightmaps = LightmapSettings.lightmaps;
        long totalBytes = 0;
        foreach (var lm in lightmaps)
        {
            if (lm.lightmapColor != null)
            {
                var path = AssetDatabase.GetAssetPath(lm.lightmapColor);
                if (!string.IsNullOrEmpty(path))
                {
                    var fi = new System.IO.FileInfo(
                        System.IO.Path.Combine(Application.dataPath, "..", path));
                    if (fi.Exists) totalBytes += fi.Length;
                }
            }
        }
        Debug.Log($"[BellTui] 라이트맵 수: {lightmaps.Length}, 총 크기: {totalBytes / 1024}KB");
    }
}
