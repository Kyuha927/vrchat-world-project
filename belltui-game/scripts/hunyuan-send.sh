#!/bin/bash
# Hunyuan3D API 에셋 전송 스크립트
# Usage: ./hunyuan-send.sh <image_path> <face_count>

API="http://192.168.75.216:8080"
IMAGE_PATH="$1"
FACE_COUNT="${2:-40000}"
ASSET_NAME=$(basename "$IMAGE_PATH" _turnaround.png)
TMPJSON="/tmp/hunyuan_${ASSET_NAME}.json"

echo "🎮 [${ASSET_NAME}] 이미지 Base64 인코딩 중..."
IMG_B64=$(base64 -i "$IMAGE_PATH")

echo "📤 [${ASSET_NAME}] Hunyuan3D API 전송 중... (face_count: ${FACE_COUNT})"
cat > "$TMPJSON" <<EOF
{
  "image": "${IMG_B64}",
  "seed": 42,
  "octree_resolution": 256,
  "num_inference_steps": 5,
  "guidance_scale": 5.0,
  "texture": true,
  "face_count": ${FACE_COUNT},
  "type": "glb"
}
EOF

RESPONSE=$(curl -s -X POST "${API}/send" \
  -H "Content-Type: application/json" \
  -d @"$TMPJSON")

rm -f "$TMPJSON"

echo "📨 응답: $RESPONSE"

# UID 추출
UID_VAL=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('uid',''))" 2>/dev/null)

if [ -z "$UID_VAL" ]; then
  echo "❌ [${ASSET_NAME}] UID를 받지 못했습니다."
  exit 1
fi

echo "✅ [${ASSET_NAME}] UID: $UID_VAL"
echo "🔄 상태 폴링 시작..."

# 상태 폴링
while true; do
  STATUS_RESP=$(curl -s "${API}/status/${UID_VAL}")
  STATUS=$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null)
  
  echo "   ⏳ [${ASSET_NAME}] 상태: $STATUS"
  
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "complete" ] || [ "$STATUS" = "done" ]; then
    echo "🎉 [${ASSET_NAME}] 생성 완료!"
    break
  elif [ "$STATUS" = "failed" ] || [ "$STATUS" = "error" ]; then
    echo "❌ [${ASSET_NAME}] 생성 실패: $STATUS_RESP"
    exit 1
  fi
  
  sleep 5
done

# 다운로드
OUTPUT_DIR="/Users/mac/VRChat_World/belltui-game/assets/raw/3d"
mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="${OUTPUT_DIR}/${ASSET_NAME}.glb"

echo "📥 [${ASSET_NAME}] GLB 다운로드 중..."
curl -s -o "$OUTPUT_FILE" "${API}/download/${UID_VAL}"

FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
echo "✅ [${ASSET_NAME}] 저장 완료: $OUTPUT_FILE ($FILE_SIZE)"
