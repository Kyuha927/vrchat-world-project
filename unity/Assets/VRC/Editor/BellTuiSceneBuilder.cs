using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;
using System.Collections.Generic;
using VRC.SDKBase;
using VRCSceneDescriptor = VRC.SDK3.Components.VRCSceneDescriptor;
#if UDONSHARP
using UdonSharp;
#endif

/// <summary>
/// 벨튀 대작전 — 씬 자동 조립 에디터 스크립트.
/// Unity 메뉴 [VRC BellTui] → Build World Scene 으로 실행.
/// ProBuilder 없이 기본 Cube/Plane으로 아파트 구조를 생성합니다.
/// </summary>
public class BellTuiSceneBuilder : EditorWindow
{
    // === 설정 상수 ===
    const float CORRIDOR_LENGTH = 30f;
    const float CORRIDOR_WIDTH = 4f;
    const float CORRIDOR_HEIGHT = 3f;
    const float DOOR_WIDTH = 1.2f;
    const float DOOR_HEIGHT = 2.2f;
    const float FLOOR_SPACING = 4.5f;

    // 층별 설정
    static readonly FloorConfig[] FLOORS = new FloorConfig[]
    {
        new FloorConfig("1F_서민", 5, 2, Color.HSVToRGB(0.67f, 0.3f, 0.12f), 0),
        new FloorConfig("2F_중산층", 6, 2, Color.HSVToRGB(0.67f, 0.3f, 0.15f), 1),
        new FloorConfig("3F_고급", 7, 1, Color.HSVToRGB(0.67f, 0.3f, 0.18f), 2),
    };

    struct FloorConfig
    {
        public string name;
        public int doorCount;
        public int hideSpots;
        public Color wallColor;
        public int droneCount;

        public FloorConfig(string n, int d, int h, Color c, int dr)
        {
            name = n; doorCount = d; hideSpots = h; wallColor = c; droneCount = dr;
        }
    }

    [MenuItem("VRC BellTui/🏗️ Build World Scene")]
    static void BuildScene()
    {
        if (Application.isBatchMode)
        {
            AutoBuild();
            return;
        }

        if (!EditorUtility.DisplayDialog("벨튀 월드 생성",
            "새로운 벨튀 월드 씬을 생성합니다.\n기존 씬 내용은 유지됩니다.\n계속하시겠습니까?",
            "생성", "취소"))
            return;

        var builder = CreateInstance<BellTuiSceneBuilder>();
        builder.Build();
    }

    /// <summary>
    /// batchmode용 진입점: -executeMethod BellTuiSceneBuilder.AutoBuild
    /// 다이얼로그 없이 즉시 실행 + 씬 자동 저장.
    /// </summary>
    static void AutoBuild()
    {
        Debug.Log("[BellTui/AutoBuild] 배치 모드 씬 생성 시작");

        // 새 씬 생성 또는 기존 씬 사용
        var scenePath = "Assets/VRC/Scenes/BellTui_World.unity";
        var scene = SceneManager.GetActiveScene();
        if (string.IsNullOrEmpty(scene.path))
        {
            scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
        }

        var builder = CreateInstance<BellTuiSceneBuilder>();
        builder.Build();

        // 씬 저장
        System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(
            System.IO.Path.Combine(Application.dataPath, "..", scenePath)));
        EditorSceneManager.SaveScene(scene, scenePath);
        Debug.Log($"[BellTui/AutoBuild] 씬 저장 완료: {scenePath}");
    }

    [MenuItem("VRC BellTui/🎮 Setup Game System")]
    static void SetupGameSystem()
    {
        SetupGameObjects();
    }

    void Build()
    {
        Debug.Log("[BellTui] ═══ 씬 생성 시작 ═══");

        // 루트 오브젝트
        var root = CreateOrFind("BellTui_World");

        // 1. 로비
        BuildLobby(root.transform);

        // 2. 아파트 복도 (3층)
        for (int i = 0; i < FLOORS.Length; i++)
        {
            BuildCorridor(root.transform, FLOORS[i], i);
        }

        // 3. 옥상
        BuildRooftop(root.transform);

        // 4. 엘리베이터 연결
        BuildElevators(root.transform);

        // 5. 조명 (Directional Light)
        SetupLighting();

        // 6. VRC Scene Descriptor
        SetupVRCDescriptor(root);

        // 7. Game System
        SetupGameObjects();

        Debug.Log("[BellTui] ═══ 씬 생성 완료! ═══");
        EditorSceneManager.MarkSceneDirty(SceneManager.GetActiveScene());
    }

    // === 로비 ===
    void BuildLobby(Transform parent)
    {
        var lobby = CreateOrFind("Lobby", parent);
        lobby.transform.localPosition = new Vector3(0, 0, 0);

        // 바닥
        var floor = CreatePrimitive("Lobby_Floor", PrimitiveType.Cube, lobby.transform);
        floor.transform.localPosition = new Vector3(6, -0.1f, 4);
        floor.transform.localScale = new Vector3(12, 0.2f, 8);
        SetColor(floor, Color.HSVToRGB(0.67f, 0.2f, 0.08f));

        // 벽
        CreateWall("Lobby_Wall_Back", lobby.transform, new Vector3(6, 1.5f, 0), new Vector3(12, 3, 0.2f));
        CreateWall("Lobby_Wall_Left", lobby.transform, new Vector3(0, 1.5f, 4), new Vector3(0.2f, 3, 8));
        CreateWall("Lobby_Wall_Right", lobby.transform, new Vector3(12, 1.5f, 4), new Vector3(0.2f, 3, 8));

        // 스코어보드 패널 (로비)
        var scorePanel = CreatePrimitive("Lobby_ScoreBoard", PrimitiveType.Cube, lobby.transform);
        scorePanel.transform.localPosition = new Vector3(6, 2f, 0.15f);
        scorePanel.transform.localScale = new Vector3(3, 2, 0.05f);
        SetColor(scorePanel, Color.black);
        SetEmission(scorePanel, new Color(0.05f, 0.05f, 0.15f));

        // 네온 사인: "빌런조합"
        var neonSign = CreatePrimitive("Lobby_NeonSign", PrimitiveType.Cube, lobby.transform);
        neonSign.transform.localPosition = new Vector3(6, 2.8f, 0.12f);
        neonSign.transform.localScale = new Vector3(2.5f, 0.4f, 0.02f);
        SetColor(neonSign, new Color(0.91f, 0.27f, 0.37f));
        SetEmission(neonSign, new Color(0.91f, 0.27f, 0.37f) * 2f);

        // 스폰 포인트 마커
        var spawn = new GameObject("SpawnPoint");
        spawn.transform.SetParent(lobby.transform);
        spawn.transform.localPosition = new Vector3(6, 0, 6);

        Debug.Log("[BellTui] ✅ 로비 생성 완료");
    }

    // === 복도 (층) ===
    void BuildCorridor(Transform parent, FloorConfig config, int floorIndex)
    {
        float yOffset = (floorIndex + 1) * FLOOR_SPACING;
        var corridor = CreateOrFind($"Corridor_{config.name}", parent);
        corridor.transform.localPosition = new Vector3(0, yOffset, 0);

        // 바닥
        var floor = CreatePrimitive("Floor", PrimitiveType.Cube, corridor.transform);
        floor.transform.localPosition = new Vector3(CORRIDOR_LENGTH / 2, -0.1f, CORRIDOR_WIDTH / 2);
        floor.transform.localScale = new Vector3(CORRIDOR_LENGTH, 0.2f, CORRIDOR_WIDTH);
        SetColor(floor, config.wallColor * 0.8f);

        // 천장
        var ceiling = CreatePrimitive("Ceiling", PrimitiveType.Cube, corridor.transform);
        ceiling.transform.localPosition = new Vector3(CORRIDOR_LENGTH / 2, CORRIDOR_HEIGHT, CORRIDOR_WIDTH / 2);
        ceiling.transform.localScale = new Vector3(CORRIDOR_LENGTH, 0.1f, CORRIDOR_WIDTH);
        SetColor(ceiling, config.wallColor * 0.6f);

        // 뒷벽 (문이 있는 벽)
        var backWall = CreatePrimitive("BackWall", PrimitiveType.Cube, corridor.transform);
        backWall.transform.localPosition = new Vector3(CORRIDOR_LENGTH / 2, CORRIDOR_HEIGHT / 2, 0);
        backWall.transform.localScale = new Vector3(CORRIDOR_LENGTH, CORRIDOR_HEIGHT, 0.15f);
        SetColor(backWall, config.wallColor);

        // 앞벽
        var frontWall = CreatePrimitive("FrontWall", PrimitiveType.Cube, corridor.transform);
        frontWall.transform.localPosition = new Vector3(CORRIDOR_LENGTH / 2, CORRIDOR_HEIGHT / 2, CORRIDOR_WIDTH);
        frontWall.transform.localScale = new Vector3(CORRIDOR_LENGTH, CORRIDOR_HEIGHT, 0.15f);
        SetColor(frontWall, config.wallColor * 1.1f);

        // 문 배치
        float doorSpacing = CORRIDOR_LENGTH / (config.doorCount + 1);
        for (int d = 0; d < config.doorCount; d++)
        {
            float xPos = doorSpacing * (d + 1);
            BuildDoor(corridor.transform, $"Door_{d}", xPos, floorIndex, d);
        }

        // 숨는 곳 배치
        for (int h = 0; h < config.hideSpots; h++)
        {
            float hx = doorSpacing * (h * 2 + 1) + doorSpacing * 0.5f;
            BuildHideSpot(corridor.transform, $"HideSpot_{h}", hx);
        }

        // 복도 라이트 (Emission 큐브 — 실시간 라이트 대신)
        for (float lx = 5; lx < CORRIDOR_LENGTH; lx += 8)
        {
            var light = CreatePrimitive($"CeilingLight_{(int)lx}", PrimitiveType.Cube, corridor.transform);
            light.transform.localPosition = new Vector3(lx, CORRIDOR_HEIGHT - 0.05f, CORRIDOR_WIDTH / 2);
            light.transform.localScale = new Vector3(1.2f, 0.05f, 0.3f);
            SetColor(light, Color.white * 0.9f);
            SetEmission(light, new Color(0.8f, 0.85f, 1f) * 1.5f);
        }

        // 네온 사인 (층마다 다른 텍스트)
        string[] signs = { "PC방", "치킨", "사이버분식" };
        if (floorIndex < signs.Length)
        {
            var sign = CreatePrimitive($"NeonSign_{signs[floorIndex]}", PrimitiveType.Cube, corridor.transform);
            sign.transform.localPosition = new Vector3(CORRIDOR_LENGTH * 0.3f, 2.6f, CORRIDOR_WIDTH + 0.05f);
            sign.transform.localScale = new Vector3(2f, 0.5f, 0.02f);
            Color neonColor = floorIndex == 0
                ? new Color(0, 0.83f, 1f)    // 시안
                : floorIndex == 1
                    ? new Color(1f, 0.82f, 0.4f) // 골드
                    : new Color(0.66f, 0.33f, 0.97f); // 퍼플
            SetColor(sign, neonColor);
            SetEmission(sign, neonColor * 2f);
        }

        Debug.Log($"[BellTui] ✅ {config.name} 생성 완료 (문 {config.doorCount}개, 숨기 {config.hideSpots}개)");
    }

    // === 문 + 초인종 ===
    void BuildDoor(Transform parent, string name, float xPos, int floorIdx, int doorIdx)
    {
        var doorRoot = new GameObject(name);
        doorRoot.transform.SetParent(parent);
        doorRoot.transform.localPosition = new Vector3(xPos, 0, 0.2f);

        // 문 프레임
        var frame = CreatePrimitive("Frame", PrimitiveType.Cube, doorRoot.transform);
        frame.transform.localPosition = new Vector3(0, DOOR_HEIGHT / 2, 0);
        frame.transform.localScale = new Vector3(DOOR_WIDTH + 0.15f, DOOR_HEIGHT + 0.1f, 0.12f);
        SetColor(frame, new Color(0.25f, 0.18f, 0.12f));

        // 문 (회전할 피봇)
        var doorPivot = new GameObject("DoorPivot");
        doorPivot.transform.SetParent(doorRoot.transform);
        doorPivot.transform.localPosition = new Vector3(-DOOR_WIDTH / 2, 0, 0);

        var door = CreatePrimitive("DoorMesh", PrimitiveType.Cube, doorPivot.transform);
        door.transform.localPosition = new Vector3(DOOR_WIDTH / 2, DOOR_HEIGHT / 2, 0);
        door.transform.localScale = new Vector3(DOOR_WIDTH, DOOR_HEIGHT, 0.08f);
        SetColor(door, new Color(0.2f, 0.2f, 0.25f));

        // 초인종 버튼
        var bell = CreatePrimitive("BellButton", PrimitiveType.Cylinder, doorRoot.transform);
        bell.transform.localPosition = new Vector3(DOOR_WIDTH / 2 + 0.2f, 1.3f, 0.08f);
        bell.transform.localScale = new Vector3(0.08f, 0.02f, 0.08f);
        SetColor(bell, new Color(0.3f, 0.3f, 0.3f));
        SetEmission(bell, new Color(0.91f, 0.27f, 0.37f) * 0.5f);

        // NPC 스폰 포인트
        var npcSpawn = new GameObject("NPCSpawnPoint");
        npcSpawn.transform.SetParent(doorRoot.transform);
        npcSpawn.transform.localPosition = new Vector3(0, 0, 0.5f);

        // NPC 비주얼 (비활성 상태의 캡슐)
        var npcVis = CreatePrimitive("NPCVisual", PrimitiveType.Capsule, doorRoot.transform);
        npcVis.transform.localPosition = new Vector3(0, 0.9f, 0.5f);
        npcVis.transform.localScale = new Vector3(0.6f, 0.9f, 0.6f);
        Color[] npcColors = {
            new Color(0.55f, 0.27f, 0.07f), // 할머니
            new Color(0.7f, 0.13f, 0.13f),  // 근육맨
            new Color(0.85f, 0.65f, 0.13f),  // 강아지집
            new Color(0.29f, 0.29f, 0.54f),  // 유령
        };
        SetColor(npcVis, npcColors[(floorIdx * 3 + doorIdx) % npcColors.Length]);
        npcVis.SetActive(false);
    }

    // === 숨는 곳 ===
    void BuildHideSpot(Transform parent, string name, float xPos)
    {
        var hide = CreatePrimitive(name, PrimitiveType.Cube, parent);
        hide.transform.localPosition = new Vector3(xPos, 0.5f, CORRIDOR_WIDTH - 0.6f);
        hide.transform.localScale = new Vector3(1f, 1f, 0.8f);
        SetColor(hide, new Color(0.45f, 0.35f, 0.2f)); // 박스 색

        // 트리거 콜라이더 추가
        var trigger = hide.AddComponent<BoxCollider>();
        trigger.isTrigger = true;
        trigger.size = new Vector3(1.5f, 2f, 1.5f);

        // 기존 콜라이더는 물리용으로 유지
    }

    // === 옥상 ===
    void BuildRooftop(Transform parent)
    {
        float yOffset = (FLOORS.Length + 1) * FLOOR_SPACING;
        var rooftop = CreateOrFind("Rooftop", parent);
        rooftop.transform.localPosition = new Vector3(0, yOffset, 0);

        // 바닥
        var floor = CreatePrimitive("Rooftop_Floor", PrimitiveType.Cube, rooftop.transform);
        floor.transform.localPosition = new Vector3(7.5f, -0.1f, 7.5f);
        floor.transform.localScale = new Vector3(15, 0.2f, 15);
        SetColor(floor, Color.HSVToRGB(0f, 0f, 0.15f));

        // 난간
        for (int side = 0; side < 4; side++)
        {
            var rail = CreatePrimitive($"Railing_{side}", PrimitiveType.Cube, rooftop.transform);
            switch (side)
            {
                case 0: rail.transform.localPosition = new Vector3(7.5f, 0.5f, 0); rail.transform.localScale = new Vector3(15, 1, 0.1f); break;
                case 1: rail.transform.localPosition = new Vector3(7.5f, 0.5f, 15); rail.transform.localScale = new Vector3(15, 1, 0.1f); break;
                case 2: rail.transform.localPosition = new Vector3(0, 0.5f, 7.5f); rail.transform.localScale = new Vector3(0.1f, 1, 15); break;
                case 3: rail.transform.localPosition = new Vector3(15, 0.5f, 7.5f); rail.transform.localScale = new Vector3(0.1f, 1, 15); break;
            }
            SetColor(rail, new Color(0.2f, 0.2f, 0.3f));
        }

        // 대형 네온사인: "THE STRONGEST VILLAIN — CHOROKI"
        var bigNeon = CreatePrimitive("NeonSign_Title", PrimitiveType.Cube, rooftop.transform);
        bigNeon.transform.localPosition = new Vector3(7.5f, 2.5f, 0.08f);
        bigNeon.transform.localScale = new Vector3(8, 1.2f, 0.03f);
        SetColor(bigNeon, new Color(0.91f, 0.27f, 0.37f));
        SetEmission(bigNeon, new Color(0.91f, 0.27f, 0.37f) * 3f);

        // 결과 스코어보드
        var resultPanel = CreatePrimitive("Rooftop_ScoreBoard", PrimitiveType.Cube, rooftop.transform);
        resultPanel.transform.localPosition = new Vector3(7.5f, 1.8f, 14.9f);
        resultPanel.transform.localScale = new Vector3(4, 2.5f, 0.05f);
        SetColor(resultPanel, Color.black);
        SetEmission(resultPanel, new Color(0.03f, 0.03f, 0.1f));

        Debug.Log("[BellTui] ✅ 옥상 생성 완료");
    }

    // === 엘리베이터 ===
    void BuildElevators(Transform parent)
    {
        var elevators = CreateOrFind("Elevators", parent);

        // 로비 → 1F
        BuildSingleElevator(elevators.transform, "EV_Lobby_to_1F",
            new Vector3(-1.5f, 0, 4),
            new Vector3(-1.5f, FLOOR_SPACING, CORRIDOR_WIDTH / 2),
            "1F");

        // 층간 (1F→2F, 2F→3F)
        for (int i = 0; i < FLOORS.Length - 1; i++)
        {
            float y = (i + 1) * FLOOR_SPACING;
            BuildSingleElevator(elevators.transform, $"EV_{i + 1}F_to_{i + 2}F",
                new Vector3(CORRIDOR_LENGTH + 1.5f, y, CORRIDOR_WIDTH / 2),
                new Vector3(CORRIDOR_LENGTH + 1.5f, y + FLOOR_SPACING, CORRIDOR_WIDTH / 2),
                $"{i + 2}F");
        }

        // 3F → 옥상
        float topY = FLOORS.Length * FLOOR_SPACING;
        BuildSingleElevator(elevators.transform, "EV_3F_to_Rooftop",
            new Vector3(CORRIDOR_LENGTH + 1.5f, topY, CORRIDOR_WIDTH / 2),
            new Vector3(7.5f, (FLOORS.Length + 1) * FLOOR_SPACING, 7.5f),
            "옥상");

        Debug.Log("[BellTui] ✅ 엘리베이터 생성 완료");
    }

    void BuildSingleElevator(Transform parent, string name, Vector3 position, Vector3 destination, string destName)
    {
        var ev = new GameObject(name);
        ev.transform.SetParent(parent);
        ev.transform.localPosition = position;

        // 엘리베이터 박스
        var box = CreatePrimitive("Box", PrimitiveType.Cube, ev.transform);
        box.transform.localPosition = Vector3.up * 1.25f;
        box.transform.localScale = new Vector3(2, 2.5f, 2);
        SetColor(box, new Color(0.15f, 0.15f, 0.2f));

        // 인터랙트 영역
        var interact = CreatePrimitive("InteractZone", PrimitiveType.Cube, ev.transform);
        interact.transform.localPosition = Vector3.up * 1f;
        interact.transform.localScale = new Vector3(1.5f, 2f, 1.5f);
        var mr = interact.GetComponent<MeshRenderer>();
        if (mr) mr.enabled = false; // 투명
        var col = interact.GetComponent<BoxCollider>();
        if (col) col.isTrigger = true;

        // 목적지 마커
        var dest = new GameObject("Destination");
        dest.transform.SetParent(ev.transform);
        dest.transform.position = destination;

        // 버튼 표시
        var btn = CreatePrimitive("Button", PrimitiveType.Cube, ev.transform);
        btn.transform.localPosition = new Vector3(0.9f, 1.3f, 0);
        btn.transform.localScale = new Vector3(0.15f, 0.15f, 0.15f);
        SetColor(btn, new Color(0, 0.83f, 1f));
        SetEmission(btn, new Color(0, 0.83f, 1f) * 2f);
    }

    // === 시스템 설정 ===
    static void SetupGameObjects()
    {
        // GameManager
        var gm = CreateOrFind("_GameManager");
        if (!gm.GetComponent<GameManager>())
        {
            Debug.Log("[BellTui] GameManager 컴포넌트를 수동으로 부착해주세요.");
        }

        // 오디오 소스
        if (!gm.GetComponent<AudioSource>())
        {
            gm.AddComponent<AudioSource>();
        }

        Debug.Log("[BellTui] ✅ 게임 시스템 설정 완료 (UdonSharp 컴포넌트는 Unity에서 수동 부착 필요)");
    }

    void SetupLighting()
    {
        // 기존 Directional Light 설정
        var lights = Object.FindObjectsOfType<Light>();
        foreach (var l in lights)
        {
            if (l.type == LightType.Directional)
            {
                l.color = new Color(0.3f, 0.3f, 0.5f);
                l.intensity = 0.3f;
                // 라이트맵 베이크용으로 설정
                l.lightmapBakeType = LightmapBakeType.Baked;
            }
        }

        // Ambient 설정
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(0.05f, 0.05f, 0.1f);
        RenderSettings.fog = true;
        RenderSettings.fogColor = new Color(0.02f, 0.02f, 0.06f);
        RenderSettings.fogDensity = 0.02f;

        Debug.Log("[BellTui] ✅ 라이팅 설정 완료 (베이크 모드)");
    }

    void SetupVRCDescriptor(GameObject root)
    {
        var descriptor = root.GetComponent<VRCSceneDescriptor>();
        if (descriptor == null)
        {
            descriptor = root.AddComponent<VRCSceneDescriptor>();
        }

        var spawn = root.transform.Find("Lobby/SpawnPoint");
        descriptor.spawns = spawn != null ? new[] { spawn } : new[] { root.transform };
        descriptor.spawnOrder = VRC_SceneDescriptor.SpawnOrder.First;
        EditorUtility.SetDirty(descriptor);

        Debug.Log("[BellTui] ✅ VRC_SceneDescriptor 부착 완료");
        Debug.Log($"[BellTui]    Spawn 위치: {descriptor.spawns[0].name}");
    }

    // === 헬퍼 ===
    static GameObject CreateOrFind(string name, Transform parent = null)
    {
        Transform found = parent != null ? parent.Find(name) : null;
        if (found == null)
        {
            // Scene root search
            foreach (var go in SceneManager.GetActiveScene().GetRootGameObjects())
            {
                if (go.name == name && parent == null) return go;
            }
        }
        else return found.gameObject;

        var obj = new GameObject(name);
        if (parent != null) obj.transform.SetParent(parent);
        return obj;
    }

    static GameObject CreatePrimitive(string name, PrimitiveType type, Transform parent)
    {
        var obj = GameObject.CreatePrimitive(type);
        obj.name = name;
        obj.transform.SetParent(parent);
        obj.isStatic = true; // 라이트맵 베이크 대상
        return obj;
    }

    static void CreateWall(string name, Transform parent, Vector3 pos, Vector3 scale)
    {
        var wall = CreatePrimitive(name, PrimitiveType.Cube, parent);
        wall.transform.localPosition = pos;
        wall.transform.localScale = scale;
        SetColor(wall, Color.HSVToRGB(0.67f, 0.15f, 0.1f));
    }

    static void SetColor(GameObject obj, Color color)
    {
        var r = obj.GetComponent<Renderer>();
        if (r == null) return;

        // Mobile/Standard Lite가 없으면 Standard 사용
        var mat = new Material(Shader.Find("Mobile/Diffuse") ?? Shader.Find("Standard"));
        mat.color = color;
        r.sharedMaterial = mat;
    }

    static void SetEmission(GameObject obj, Color emissionColor)
    {
        var r = obj.GetComponent<Renderer>();
        if (r == null || r.sharedMaterial == null) return;

        var mat = r.sharedMaterial;
        if (mat.HasProperty("_EmissionColor"))
        {
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", emissionColor);
        }
    }
}
