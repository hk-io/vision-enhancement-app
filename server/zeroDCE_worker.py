#!/usr/bin/env python3
"""
Zero-DCE++ Worker Script

Standalone Python script that runs Zero-DCE++ inference.
Called by Node.js as a subprocess to avoid PyTorch/CUDA compatibility issues.

Reads JSON input from stdin, processes image, writes JSON output to stdout.
"""

import sys
import json
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from PIL import Image
import io
import base64
import os
from scipy.ndimage import gaussian_filter


def apply_unsharp_mask(image_array, radius=1.0, strength=0.5):
    """
    Apply unsharp mask sharpening to restore edge definition.
    
    Args:
        image_array: numpy array with shape (H, W, C) and values 0-1
        radius: gaussian blur radius (small for subtle sharpening)
        strength: sharpening strength (0.5 = mild)
    
    Returns:
        sharpened image array
    """
    sharpened = image_array.copy()
    
    for c in range(image_array.shape[2]):
        channel = image_array[:, :, c]
        blurred = gaussian_filter(channel, sigma=radius)
        sharpened[:, :, c] = channel + strength * (channel - blurred)
    
    sharpened = np.clip(sharpened, 0, 1)
    return sharpened


class CSDN_Tem(nn.Module):
    """Depthwise Separable Convolution block"""
    def __init__(self, in_ch, out_ch):
        super(CSDN_Tem, self).__init__()
        self.depth_conv = nn.Conv2d(
            in_channels=in_ch,
            out_channels=in_ch,
            kernel_size=3,
            stride=1,
            padding=1,
            groups=in_ch
        )
        self.point_conv = nn.Conv2d(
            in_channels=in_ch,
            out_channels=out_ch,
            kernel_size=1,
            stride=1,
            padding=0,
            groups=1
        )

    def forward(self, input):
        out = self.depth_conv(input)
        out = self.point_conv(out)
        return out


class enhance_net_nopool(nn.Module):
    """Zero-DCE++ enhancement network"""
    def __init__(self, scale_factor):
        super(enhance_net_nopool, self).__init__()
        
        self.relu = nn.ReLU(inplace=True)
        self.scale_factor = scale_factor
        number_f = 32
        
        # Zero-DCE++ architecture with depthwise separable convolutions
        self.e_conv1 = CSDN_Tem(3, number_f)
        self.e_conv2 = CSDN_Tem(number_f, number_f)
        self.e_conv3 = CSDN_Tem(number_f, number_f)
        self.e_conv4 = CSDN_Tem(number_f, number_f)
        self.e_conv5 = CSDN_Tem(number_f * 2, number_f)
        self.e_conv6 = CSDN_Tem(number_f * 2, number_f)
        self.e_conv7 = CSDN_Tem(number_f * 2, 3)
    
    def enhance(self, x, x_r):
        """Iterative enhancement using learned illumination map"""
        x = x + x_r * (torch.pow(x, 2) - x)
        x = x + x_r * (torch.pow(x, 2) - x)
        x = x + x_r * (torch.pow(x, 2) - x)
        enhance_image_1 = x + x_r * (torch.pow(x, 2) - x)
        x = enhance_image_1 + x_r * (torch.pow(enhance_image_1, 2) - enhance_image_1)
        x = x + x_r * (torch.pow(x, 2) - x)
        x = x + x_r * (torch.pow(x, 2) - x)
        enhance_image = x + x_r * (torch.pow(x, 2) - x)
        
        return enhance_image
    
    def forward(self, x):
        if self.scale_factor == 1:
            x_down = x
        else:
            x_down = F.interpolate(x, scale_factor=1/self.scale_factor, mode='bilinear')
        
        x1 = self.relu(self.e_conv1(x_down))
        x2 = self.relu(self.e_conv2(x1))
        x3 = self.relu(self.e_conv3(x2))
        x4 = self.relu(self.e_conv4(x3))
        x5 = self.relu(self.e_conv5(torch.cat([x3, x4], 1)))
        x6 = self.relu(self.e_conv6(torch.cat([x2, x5], 1)))
        x_r = F.tanh(self.e_conv7(torch.cat([x1, x6], 1)))
        
        if self.scale_factor == 1:
            x_r = x_r
        else:
            x_r = F.interpolate(x_r, scale_factor=self.scale_factor, mode='bicubic', align_corners=False)
        
        enhance_image = self.enhance(x, x_r)
        return enhance_image, x_r


def main():
    """Main worker function"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        image_base64 = input_data.get('image_base64')
        strength = input_data.get('strength', 1.0)
        
        if not image_base64:
            raise ValueError('No image_base64 provided')
        
        # Initialize model
        device = torch.device('cpu')
        scale_factor = 2
        model = enhance_net_nopool(scale_factor)
        
        # Find model file
        model_path = os.path.join(os.path.dirname(__file__), 'Epoch99.pth')
        if not os.path.exists(model_path):
            raise FileNotFoundError(f'Model file not found at {model_path}')
        
        # Load model weights
        state_dict = torch.load(model_path, map_location=device)
        model.load_state_dict(state_dict)
        model.to(device)
        model.eval()
        
        # Decode base64 image
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        # Prepare input tensor
        img_array = np.asarray(image) / 255.0
        img_tensor = torch.from_numpy(img_array).float()
        
        # Ensure minimum image size (at least 12x12 to work with scale factor)
        original_h, original_w = img_tensor.shape[0], img_tensor.shape[1]
        if original_h < 12 or original_w < 12:
            # Resize small images to at least 12x12
            new_h = max(original_h, 12)
            new_w = max(original_w, 12)
            img_tensor = F.interpolate(
                img_tensor.unsqueeze(0).permute(0, 3, 1, 2),
                size=(new_h, new_w),
                mode='bilinear',
                align_corners=False
            ).squeeze(0).permute(1, 2, 0)
        
        # Ensure dimensions are divisible by scale factor (12)
        h = (img_tensor.shape[0] // 12) * 12
        w = (img_tensor.shape[1] // 12) * 12
        img_tensor = img_tensor[0:h, 0:w, :]
        
        # Convert to CHW format and add batch dimension
        img_tensor = img_tensor.permute(2, 0, 1).unsqueeze(0).to(device)
        
        # Run inference
        with torch.no_grad():
            enhanced_image, illumination_map = model(img_tensor)
        
        # Apply strength multiplier to illumination map
        if strength != 1.0:
            illumination_map = illumination_map * strength
            enhanced_image = img_tensor + illumination_map * (torch.pow(img_tensor, 2) - img_tensor)
        
        # Clamp to valid range
        enhanced_image = torch.clamp(enhanced_image, 0, 1)
        
        # Convert to numpy for sharpening
        enhanced_array_float = enhanced_image.squeeze(0).permute(1, 2, 0).cpu().numpy()
        
        # Apply unsharp mask sharpening to restore edge definition
        enhanced_array_float = apply_unsharp_mask(enhanced_array_float, radius=1.0, strength=0.5)
        
        # Apply additional sharpening to compensate for camera autofocus blur on foreground
        enhanced_array_float = apply_unsharp_mask(enhanced_array_float, radius=0.5, strength=0.8)
        
        # Convert back to PIL Image
        enhanced_array = (enhanced_array_float * 255).astype(np.uint8)
        enhanced_pil = Image.fromarray(enhanced_array)
        
        # Encode to base64
        buffer = io.BytesIO()
        enhanced_pil.save(buffer, format='JPEG', quality=90)
        enhanced_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        # Output result as JSON
        result = {
            'success': True,
            'enhanced_image': enhanced_base64,
        }
        print(json.dumps(result))
        
    except Exception as e:
        result = {
            'success': False,
            'error': str(e),
        }
        print(json.dumps(result))
        sys.exit(1)


if __name__ == '__main__':
    main()
