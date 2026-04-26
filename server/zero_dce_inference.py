#!/usr/bin/env python3
"""
Zero-DCE++ Inference Script
Loads Epoch99.pth model and runs inference on input image
"""

import sys
import torch
import torchvision.transforms as transforms
from PIL import Image
import numpy as np

# Add repo to path
sys.path.insert(0, '/tmp/Zero-DCE_extension/Zero-DCE++')

# Import model architecture
from model import enhance_net_nopool

def load_model(model_path, device='cpu'):
    """Load Zero-DCE++ model"""
    model = enhance_net_nopool()
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.eval()
    return model.to(device)

def enhance_image(image_path, model_path, output_path):
    """
    Run Zero-DCE++ enhancement on image
    """
    device = torch.device('cpu')
    
    # Load model
    model = load_model(model_path, device)
    
    # Load and preprocess image
    image = Image.open(image_path).convert('RGB')
    original_size = image.size
    
    # Resize to 256x256 for model input
    image_resized = image.resize((256, 256), Image.Resampling.LANCZOS)
    
    # Convert to tensor
    transform = transforms.Compose([
        transforms.ToTensor(),
    ])
    image_tensor = transform(image_resized).unsqueeze(0).to(device)
    
    # Run inference
    with torch.no_grad():
        enhancement_map = model(image_tensor)
    
    # Get the enhancement map (A parameter from the paper)
    # enhancement_map shape: [1, 24, 256, 256]
    # We need to average across the 24 channels to get a single enhancement map
    enhancement_map = enhancement_map.mean(dim=1, keepdim=True)  # [1, 1, 256, 256]
    
    # Resize back to original size
    enhancement_map_resized = torch.nn.functional.interpolate(
        enhancement_map,
        size=original_size,
        mode='bilinear',
        align_corners=False
    )
    
    # Convert to numpy and normalize to 0-255
    enhancement_np = enhancement_map_resized.squeeze().cpu().numpy()
    enhancement_np = np.clip(enhancement_np * 255, 0, 255).astype(np.uint8)
    
    # Save as grayscale image (enhancement map)
    enhancement_image = Image.fromarray(enhancement_np, mode='L')
    enhancement_image.save(output_path)

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python zero_dce_inference.py <input_image> <output_image> <model_path>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    model_path = sys.argv[3]
    
    try:
        enhance_image(input_path, model_path, output_path)
        print(f"Enhancement complete: {output_path}")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
