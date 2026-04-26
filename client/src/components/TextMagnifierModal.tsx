/**
 * Text Magnifier Modal Component
 * 
 * Displays tapped text in a modal with zoom slider (16-48pt)
 * Allows users to magnify text for better readability
 * Includes copy button to copy text to clipboard
 */

import { useState, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface TextMagnifierModalProps {
  isOpen: boolean;
  text: string;
  onClose: () => void;
}

export function TextMagnifierModal({
  isOpen,
  text,
  onClose,
}: TextMagnifierModalProps) {
  const [fontSize, setFontSize] = useState(24); // Default 24pt
  const [copied, setCopied] = useState(false);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      {/* Modal container */}
      <div
        className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Magnify Text</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Magnified text display */}
        <div
          className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6 flex items-center justify-center min-h-32"
          style={{
            backgroundColor: '#000080',  // Navy blue background
            borderColor: '#000080',
          }}
        >
          <span
            style={{
              fontSize: `${fontSize}pt`,
              color: '#FFFFFF',  // White text
              fontWeight: '600',
              fontFamily: 'Arial, sans-serif',
              wordWrap: 'break-word',
              wordBreak: 'break-word',
              textAlign: 'center',
            }}
          >
            {text}
          </span>
        </div>

        {/* Zoom slider */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">
              Font Size
            </label>
            <span className="text-sm font-semibold text-gray-900">
              {fontSize}pt
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-600 font-medium">16</span>
            <Slider
              value={[fontSize]}
              onValueChange={(value) => setFontSize(value[0])}
              min={16}
              max={48}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-gray-600 font-medium">48</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleCopy}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </Button>
          <Button
            onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-2 rounded-lg transition-colors"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
