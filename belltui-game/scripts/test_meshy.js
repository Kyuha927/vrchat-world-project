import 'dotenv/config';

async function test() {
  const MESHY_BASE = 'https://api.meshy.ai/openapi/v2';
  const url = `${MESHY_BASE}/image-to-3d`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer fake_key`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      enable_pbr: true
    })
  });
  
  console.log(res.status);
  const text = await res.text();
  console.log(text);
}

test();
