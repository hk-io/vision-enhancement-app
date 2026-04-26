// Parse hocr HTML to extract word bounding boxes
export const parseHocrToWords = (hocrHtml: string): Array<{text: string, x0: number, y0: number, x1: number, y1: number, confidence: number}> => {
  const words: any[] = [];
  
  if (!hocrHtml) {
    console.log('No hocr HTML provided');
    return words;
  }
  
  console.log('Parsing hocr HTML, length:', hocrHtml.length);
  
  // Create a temporary div to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(hocrHtml, 'text/html');
  
  // Find all word spans (class="ocrx_word")
  const wordSpans = doc.querySelectorAll('span.ocrx_word');
  console.log('Found ocrx_word spans:', wordSpans.length);
  
  // Also try to find any span with bbox in title
  const allSpans = doc.querySelectorAll('span[title*="bbox"]');
  console.log('Found spans with bbox in title:', allSpans.length);
  
  wordSpans.forEach((span) => {
    const text = span.textContent || '';
    const title = span.getAttribute('title') || '';
    
    console.log('Word:', text, 'title:', title);
    
    // Parse bbox from title: "bbox x0 y0 x1 y1 [confidence]"
    const bboxMatch = title.match(/bbox (\d+) (\d+) (\d+) (\d+)/);
    const confMatch = title.match(/x_wconf (\d+)/);
    
    if (bboxMatch && text.trim()) {
      words.push({
        text: text.trim(),
        x0: parseInt(bboxMatch[1]),
        y0: parseInt(bboxMatch[2]),
        x1: parseInt(bboxMatch[3]),
        y1: parseInt(bboxMatch[4]),
        confidence: confMatch ? parseInt(confMatch[1]) : 50
      });
    }
  });
  
  console.log('Extracted words from hocr:', words.length);
  return words;
};
