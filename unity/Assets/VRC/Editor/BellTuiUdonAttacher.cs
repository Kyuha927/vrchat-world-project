using UnityEngine;
using UnityEditor;
using System;
using System.IO;
using System.Linq;
using System.Reflection;
using UdonSharp;
using UdonSharpEditor;

/// <summary>
/// 벨튀 대작전 — UdonSharp 컴포넌트 자동 부착 도구.
/// Unity 메뉴 [VRC BellTui] → Attach Udon Scripts 로 실행.
/// BellTuiSceneBuilder로 생성된 씬에 UdonSharp 스크립트를 자동 연결합니다.
/// </summary>
public class BellTuiUdonAttacher : Editor
{
    [MenuItem("VRC BellTui/🔗 Attach Udon Scripts")]
    static void AttachAll()
    {
        Debug.Log("[BellTui] ═══ UdonSharp 스크립트 부착 시작 ═══");

        EnsureProgramAssets();

        // GameManager 부착
        AttachGameManager();

        // ScoreBoard 부착
        AttachScoreBoards();

        // NotorietySystem 부착
        AttachNotoriety();

        // Door + Bell 부착
        AttachDoorsAndBells();

        // HideSpot 부착
        AttachHideSpots();

        // FloorElevator 부착
        AttachElevators();

        Debug.Log("[BellTui] ═══ UdonSharp 스크립트 부착 완료! ═══");
        Debug.Log("[BellTui] ⚠️ 각 컴포넌트의 Inspector에서 참조를 확인해주세요.");
    }

    static void EnsureProgramAssets()
    {
        EnsureFolder("Assets/VRC/UdonPrograms");

        EnsureProgramAsset<GameManager>();
        EnsureProgramAsset<ScoreBoard>();
        EnsureProgramAsset<NotorietySystem>();
        EnsureProgramAsset<DoorController>();
        EnsureProgramAsset<BellButton>();
        EnsureProgramAsset<HideSpot>();
        EnsureProgramAsset<FloorElevator>();

        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        ResetUdonSharpProgramAssetCache();
        UdonSharpProgramAsset.CompileAllCsPrograms(true);
    }

    static void EnsureProgramAsset<T>() where T : UdonSharpBehaviour
    {
        var type = typeof(T);
        if (UdonSharpEditorUtility.GetUdonSharpProgramAsset(type) != null)
        {
            return;
        }

        var scriptPath = $"Assets/VRC/Scripts/{type.Name}.cs";
        var script = AssetDatabase.LoadAssetAtPath<MonoScript>(scriptPath);
        if (script == null)
        {
            throw new FileNotFoundException($"UdonSharp script not found: {scriptPath}");
        }

        var assetPath = $"Assets/VRC/UdonPrograms/{type.Name}.asset";
        var programAsset = AssetDatabase.LoadAssetAtPath<UdonSharpProgramAsset>(assetPath);
        if (programAsset == null)
        {
            programAsset = CreateInstance<UdonSharpProgramAsset>();
            AssetDatabase.CreateAsset(programAsset, assetPath);
            Debug.Log($"[BellTui] UdonSharp ProgramAsset 생성: {assetPath}");
        }

        programAsset.sourceCsScript = script;
        EditorUtility.SetDirty(programAsset);
    }

    static void EnsureFolder(string folderPath)
    {
        if (AssetDatabase.IsValidFolder(folderPath))
        {
            return;
        }

        var parts = folderPath.Split('/');
        var current = parts[0];
        for (int i = 1; i < parts.Length; i++)
        {
            var next = $"{current}/{parts[i]}";
            if (!AssetDatabase.IsValidFolder(next))
            {
                AssetDatabase.CreateFolder(current, parts[i]);
            }
            current = next;
        }
    }

    static void ResetUdonSharpProgramAssetCache()
    {
        typeof(UdonSharpEditorUtility)
            .GetMethod("ResetCaches", BindingFlags.NonPublic | BindingFlags.Static)
            ?.Invoke(null, null);
    }

    /// <summary>
    /// batchmode용 진입점: -executeMethod BellTuiUdonAttacher.AutoAttach
    /// 씬을 열고 → Udon 부착 → 씬 저장.
    /// </summary>
    static void AutoAttach()
    {
        Debug.Log("[BellTui/AutoAttach] 배치 모드 Udon 부착 시작");

        // 저장된 씬 열기
        var scenePath = "Assets/VRC/Scenes/BellTui_World.unity";
        if (System.IO.File.Exists(System.IO.Path.Combine(Application.dataPath, "..", scenePath)))
        {
            UnityEditor.SceneManagement.EditorSceneManager.OpenScene(scenePath);
        }

        AttachAll();

        // 씬 저장
        UnityEditor.SceneManagement.EditorSceneManager.SaveScene(
            UnityEngine.SceneManagement.SceneManager.GetActiveScene());
        Debug.Log("[BellTui/AutoAttach] 씬 저장 완료");
    }

    static void AttachGameManager()
    {
        var gm = GameObject.Find("_GameManager");
        if (gm == null)
        {
            gm = new GameObject("_GameManager");
            gm.AddComponent<AudioSource>();
        }

        if (gm.GetComponent<UdonSharpBehaviour>() == null)
        {
            gm.AddUdonSharpComponent(typeof(GameManager));
            Debug.Log("[BellTui] ✅ GameManager 부착");
        }
    }

    static void AttachScoreBoards()
    {
        string[] boardNames = { "Lobby_ScoreBoard", "Rooftop_ScoreBoard" };
        foreach (var name in boardNames)
        {
            var obj = FindRecursive(name);
            if (obj == null) continue;

            if (obj.GetComponent<UdonSharpBehaviour>() == null)
            {
                obj.AddUdonSharpComponent(typeof(ScoreBoard));
                Debug.Log($"[BellTui] ✅ ScoreBoard 부착: {name}");
            }
        }
    }

    static void AttachNotoriety()
    {
        var gm = GameObject.Find("_GameManager");
        if (gm == null) return;

        var notoriety = gm.transform.Find("NotorietySystem")?.gameObject;
        if (notoriety == null)
        {
            notoriety = new GameObject("NotorietySystem");
            notoriety.transform.SetParent(gm.transform);
        }

        if (notoriety.GetComponent<UdonSharpBehaviour>() == null)
        {
            notoriety.AddUdonSharpComponent(typeof(NotorietySystem));
            Debug.Log("[BellTui] ✅ NotorietySystem 부착");
        }
    }

    static void AttachDoorsAndBells()
    {
        // 씬에서 "Door_"로 시작하는 모든 오브젝트 찾기
        var allObjects = Resources.FindObjectsOfTypeAll<GameObject>();
        var doors = allObjects
            .Where(go => go.name.StartsWith("Door_") && go.scene.isLoaded)
            .ToArray();

        var gm = GameObject.Find("_GameManager");

        foreach (var doorRoot in doors)
        {
            // DoorController 부착
            if (doorRoot.GetComponent<UdonSharpBehaviour>() == null)
            {
                doorRoot.AddUdonSharpComponent(typeof(DoorController));
            }

            // 문 피봇 연결
            var doorPivot = doorRoot.transform.Find("DoorPivot");
            var npcSpawn = doorRoot.transform.Find("NPCSpawnPoint");
            var npcVis = doorRoot.transform.Find("NPCVisual")?.gameObject;

            // DoorController 참조 설정은 Inspector에서 수동으로 해야 함
            // (UdonSharp 직렬화 제한)

            // BellButton 부착
            var bellObj = doorRoot.transform.Find("BellButton")?.gameObject;
            if (bellObj != null && bellObj.GetComponent<UdonSharpBehaviour>() == null)
            {
                bellObj.AddUdonSharpComponent(typeof(BellButton));
            }

            // AudioSource 추가
            if (doorRoot.GetComponent<AudioSource>() == null)
            {
                doorRoot.AddComponent<AudioSource>();
            }
            if (bellObj != null && bellObj.GetComponent<AudioSource>() == null)
            {
                bellObj.AddComponent<AudioSource>();
            }

            Debug.Log($"[BellTui] ✅ Door + Bell 부착: {doorRoot.name}");
        }
    }

    static void AttachHideSpots()
    {
        var allObjects = Resources.FindObjectsOfTypeAll<GameObject>();
        var hideSpots = allObjects
            .Where(go => go.name.StartsWith("HideSpot_") && go.scene.isLoaded)
            .ToArray();

        foreach (var spot in hideSpots)
        {
            if (spot.GetComponent<UdonSharpBehaviour>() == null)
            {
                spot.AddUdonSharpComponent(typeof(HideSpot));
                Debug.Log($"[BellTui] ✅ HideSpot 부착: {spot.name}");
            }
        }
    }

    static void AttachElevators()
    {
        var allObjects = Resources.FindObjectsOfTypeAll<GameObject>();
        var elevators = allObjects
            .Where(go => go.name.StartsWith("EV_") && go.scene.isLoaded)
            .ToArray();

        foreach (var ev in elevators)
        {
            var interactZone = ev.transform.Find("InteractZone")?.gameObject;
            if (interactZone == null) interactZone = ev;

            if (interactZone.GetComponent<UdonSharpBehaviour>() == null)
            {
                interactZone.AddUdonSharpComponent(typeof(FloorElevator));
            }

            if (ev.GetComponent<AudioSource>() == null)
            {
                ev.AddComponent<AudioSource>();
            }

            Debug.Log($"[BellTui] ✅ FloorElevator 부착: {ev.name}");
        }
    }

    static GameObject FindRecursive(string name)
    {
        var allObjects = Resources.FindObjectsOfTypeAll<GameObject>();
        return allObjects.FirstOrDefault(go => go.name == name && go.scene.isLoaded);
    }
}
