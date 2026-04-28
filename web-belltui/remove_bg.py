import os
import glob
from rembg import remove
from PIL import Image
import numpy as np

asset_dir = '/Users/mac/VRChat_World/web-belltui/assets/2d'
files = glob.glob(os.path.join(asset_dir, '*.png'))

for f in files:
    filename = os.path.basename(f)
    if filename.startswith('bg_'):
        print(f"Skipping background: {filename}")
        continue
    
    print(f"Processing {filename}...")
    
    try:
        input_img = Image.open(f).convert("RGBA")
        # Remove background
        output_img = remove(input_img)
        
        # Threshold alpha channel to ensure crisp pixel edges (no anti-aliasing)
        arr = np.array(output_img)
        arr[:, :, 3] = np.where(arr[:, :, 3] > 10, 255, 0) # Use a low threshold to preserve small details
        
        # Save back, overwriting the original
        Image.fromarray(arr).save(f)
        
    except Exception as e:
        print(f"Failed {filename}: {e}")

print("Done processing all sprites!")
