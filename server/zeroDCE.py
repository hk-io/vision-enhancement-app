"""
Zero-DCE++ Enhancement Module

Provides real-time image enhancement for low-vision users using the official
Zero-DCE++ model (Chongyi Li, Chunle Guo, Chen Change Loy, 2021).

Academic use only - Attribution-NonCommercial 4.0 International License
Paper: https://arxiv.org/abs/2103.00860
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from PIL import Image
import io
import base64
import os


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
        self.upsample = nn.UpsamplingBilinear2d(scale_factor=self.scale_factor)
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
            x_r = self.upsample(x_r)
        
        enhance_image = self.enhance(x, x_r)
        return enhance_image, x_r


# Global model instance - loaded once on server startup
_model = None
_device = None


def initialize_model():
    """Load the pre-trained Zero-DCE++ model"""
    global _model, _device
    
    _device = torch.device('cpu')  # Use CPU for compatibility
    scale_factor = 12
    
    _model = enhance_net_nopool(scale_factor)
    model_path = os.path.join(os.path.dirname(__file__), 'Epoch99.pth')
    
    try:
        state_dict = torch.load(model_path, map_location=_device)
        _model.load_state_dict(state_dict)
        _model.to(_device)
        _model.eval()
        print('✅ Zero-DCE++ model loaded successfully from', model_path)
        return True
    except Exception as e:
        print(f'❌ Failed to load model from {model_path}: {e}')
        return False


def enhance_image_base64(image_base64: str, strength: float = 1.0) -> str:
    """
    Enhance an image using Zero-DCE++ and return enhanced base64
    
    Args:
        image_base64: Base64 encoded image data (with or without data URI prefix)
        strength: Enhancement strength multiplier (0.0-2.0), default 1.0
    
    Returns:
        Base64 encoded enhanced image
    """
    global _model, _device
    
    if _model is None:
        raise RuntimeError('Zero-DCE++ model not initialized')
    
    try:
        # Decode base64 image
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        # Prepare input
        img_array = np.asarray(image) / 255.0
        img_tensor = torch.from_numpy(img_array).float()
        
        # Ensure dimensions are divisible by scale factor (12)
        h = (img_tensor.shape[0] // 12) * 12
        w = (img_tensor.shape[1] // 12) * 12
        img_tensor = img_tensor[0:h, 0:w, :]
        
        # Convert to CHW format and add batch dimension
        img_tensor = img_tensor.permute(2, 0, 1).unsqueeze(0).to(_device)
        
        # Run inference
        with torch.no_grad():
            enhanced_image, illumination_map = _model(img_tensor)
        
        # Apply strength multiplier to illumination map
        if strength != 1.0:
            illumination_map = illumination_map * strength
            enhanced_image = img_tensor + illumination_map * (torch.pow(img_tensor, 2) - img_tensor)
        
        # Clamp to valid range
        enhanced_image = torch.clamp(enhanced_image, 0, 1)
        
        # Convert back to PIL Image
        enhanced_array = (enhanced_image.squeeze(0).permute(1, 2, 0).cpu().numpy() * 255).astype(np.uint8)
        enhanced_pil = Image.fromarray(enhanced_array)
        
        # Encode to base64
        buffer = io.BytesIO()
        enhanced_pil.save(buffer, format='JPEG', quality=90)
        enhanced_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return enhanced_base64
    
    except Exception as e:
        print(f'❌ Enhancement error: {e}')
        raise
