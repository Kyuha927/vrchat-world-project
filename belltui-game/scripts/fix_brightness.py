import bpy
import os
import sys

# Usage: blender --background --python fix_brightness.py -- input.glb output.glb brightness_factor

def fix_brightness(input_path, output_path, factor=2.0):
    # Clear existing data
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    # Import GLB
    bpy.ops.import_scene.gltf(filepath=input_path)
    
    # Iterate through all materials
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        
        # Find the Principled BSDF node
        nodes = mat.node_tree.nodes
        bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
        
        if bsdf:
            # Check if there is a texture connected to Base Color
            base_color_input = bsdf.inputs['Base Color']
            if base_color_input.is_linked:
                # Insert a Bright/Contrast node
                tex_node = base_color_input.links[0].from_node
                bright_node = nodes.new('ShaderNodeBrightContrast')
                bright_node.inputs['Bright'].default_value = factor - 1.0 # Simple offset for brightness
                
                # Re-link: Tex -> Bright -> BSDF
                mat.node_tree.links.new(tex_node.outputs[0], bright_node.inputs[0])
                mat.node_tree.links.new(bright_node.outputs[0], base_color_input)
                print(f"Added brightness node to material: {mat.name}")
            else:
                # Just brighten the color value
                c = bsdf.inputs['Base Color'].default_value
                bsdf.inputs['Base Color'].default_value = (min(c[0]*factor, 1), min(c[1]*factor, 1), min(c[2]*factor, 1), c[3])
                print(f"Brightened solid color for material: {mat.name}")

    # Export GLB
    bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')
    print(f"Exported to {output_path}")

if __name__ == "__main__":
    # Get args after "--"
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    
    if len(args) < 2:
        print("Error: Missing arguments")
        sys.exit(1)
        
    in_file = args[0]
    out_file = args[1]
    f = float(args[2]) if len(args) > 2 else 2.0
    
    fix_brightness(in_file, out_file, f)
