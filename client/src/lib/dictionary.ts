/**
 * English Dictionary Validation
 * Supports English, Finnish, and Arabic
 */

// Common English words
const ENGLISH_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must',
  'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would',
  'about', 'after', 'all', 'also', 'as', 'back', 'because', 'before', 'between', 'both',
  'can', 'come', 'could', 'day', 'did', 'different', 'do', 'does', 'done', 'down',
  'each', 'early', 'even', 'every', 'example', 'eye', 'face', 'fact', 'feel', 'few',
  'find', 'first', 'follow', 'food', 'found', 'from', 'full', 'get', 'give', 'go',
  'good', 'got', 'group', 'grow', 'had', 'hand', 'has', 'have', 'head', 'hear',
  'heart', 'help', 'here', 'high', 'him', 'his', 'home', 'how', 'idea', 'if',
  'important', 'in', 'into', 'is', 'it', 'its', 'just', 'keep', 'kind', 'know',
  'land', 'language', 'large', 'last', 'later', 'learn', 'least', 'leave', 'left',
  'less', 'let', 'life', 'like', 'line', 'little', 'live', 'long', 'look', 'love',
  'made', 'main', 'make', 'man', 'many', 'may', 'me', 'mean', 'might', 'mind',
  'more', 'most', 'move', 'much', 'must', 'my', 'myself', 'name', 'near', 'need',
  'never', 'new', 'next', 'no', 'not', 'now', 'number', 'of', 'off', 'often',
  'old', 'on', 'once', 'one', 'only', 'open', 'or', 'other', 'our', 'out',
  'over', 'own', 'page', 'part', 'people', 'place', 'play', 'point', 'possible',
  'present', 'problem', 'process', 'produce', 'program', 'project', 'provide', 'public',
  'put', 'question', 'quite', 'read', 'real', 'reason', 'receive', 'record', 'result',
  'return', 'right', 'room', 'run', 'said', 'same', 'say', 'school', 'science',
  'see', 'seem', 'seen', 'self', 'sense', 'sentence', 'set', 'several', 'shall',
  'she', 'should', 'show', 'side', 'sight', 'sign', 'similar', 'simple', 'since',
  'single', 'sister', 'sit', 'site', 'size', 'small', 'so', 'social', 'some',
  'something', 'sometimes', 'son', 'soon', 'sound', 'source', 'space', 'speak',
  'special', 'specific', 'speech', 'spend', 'spirit', 'spoke', 'spread', 'spring',
  'staff', 'stage', 'stand', 'start', 'state', 'statement', 'station', 'stay',
  'step', 'still', 'stop', 'story', 'straight', 'strange', 'street', 'strong',
  'structure', 'student', 'study', 'stuff', 'subject', 'such', 'sudden', 'suffer',
  'suggest', 'suit', 'summer', 'sun', 'sure', 'surface', 'system', 'table',
  'take', 'taken', 'talk', 'task', 'taste', 'teach', 'teacher', 'team', 'tell',
  'ten', 'tend', 'term', 'test', 'text', 'than', 'thank', 'that', 'the',
  'their', 'them', 'themselves', 'then', 'theory', 'there', 'therefore', 'these',
  'they', 'thing', 'think', 'third', 'this', 'those', 'though', 'thought', 'three',
  'through', 'throughout', 'throw', 'thus', 'time', 'tiny', 'tip', 'title',
  'to', 'today', 'together', 'told', 'tomorrow', 'tone', 'too', 'took', 'top',
  'topic', 'total', 'touch', 'tough', 'toward', 'town', 'trade', 'traditional',
  'train', 'transfer', 'travel', 'treat', 'tree', 'trend', 'trial', 'tribe',
  'trick', 'tried', 'tries', 'trip', 'trouble', 'true', 'truly', 'trust',
  'truth', 'try', 'turn', 'type', 'typical', 'uncle', 'under', 'understand',
  'unit', 'until', 'unusual', 'up', 'upon', 'upper', 'upset', 'us', 'use',
  'used', 'useful', 'user', 'usual', 'usually', 'value', 'various', 'vast',
  'very', 'view', 'village', 'visit', 'voice', 'wait', 'walk', 'wall', 'want',
  'war', 'warm', 'watch', 'water', 'wave', 'way', 'we', 'weak', 'wear',
  'week', 'weight', 'welcome', 'well', 'went', 'were', 'west', 'what', 'whatever',
  'when', 'whenever', 'where', 'wherever', 'whether', 'which', 'while', 'white',
  'who', 'whole', 'whom', 'whose', 'why', 'wide', 'wife', 'wild', 'will',
  'win', 'window', 'wing', 'winter', 'wire', 'wisdom', 'wise', 'wish', 'with',
  'within', 'without', 'woman', 'wonder', 'wood', 'word', 'work', 'world',
  'worry', 'would', 'write', 'written', 'wrong', 'yard', 'year', 'yellow',
  'yes', 'yet', 'you', 'young', 'your', 'yourself', 'zero', 'zone',
  'jenkki', 'spearmint', 'original', 'coca', 'cola', 'pepsi', 'sprite',
  'fanta', 'orange', 'lemon', 'lime', 'apple', 'grape', 'cherry',
  'food', 'drink', 'water', 'juice', 'tea', 'coffee', 'milk', 'beer',
  'wine', 'sugar', 'salt', 'pepper', 'spice', 'sauce', 'soup', 'bread',
  'rice', 'pasta', 'meat', 'fish', 'chicken', 'beef', 'pork', 'fruit',
  'vegetable', 'cheese', 'butter', 'oil', 'honey', 'jam', 'candy', 'chocolate',
]);

// Finnish common words
const FINNISH_WORDS = new Set([
  'ja', 'että', 'se', 'on', 'ei', 'hän', 'ne', 'minä', 'sinä', 'hyvä',
  'paha', 'suuri', 'pieni', 'uusi', 'vanha', 'kaunis', 'ruma', 'terve',
  'sairas', 'onnellinen', 'surullinen', 'vihainen', 'pelkäävä', 'iloinen',
  'koti', 'katu', 'kaupunki', 'maa', 'vesi', 'puu', 'kukka', 'eläin',
  'ihminen', 'nainen', 'mies', 'lapsi', 'poika', 'tyttö', 'äiti', 'isä',
  'sisarukset', 'ystävä', 'opettaja', 'lääkäri', 'poliisi', 'sotilas',
  'ruoka', 'juoma', 'liha', 'kala', 'kana', 'lehmä', 'hevonen', 'koira',
  'kissa', 'lintu', 'kärpänen', 'mehiläinen', 'matopuoli', 'käärme',
  'auto', 'bussit', 'juna', 'lentokone', 'laiva', 'polkupyörä', 'moottoripyörä',
  'pallo', 'pelaaja', 'peli', 'urheilu', 'voittaa', 'hävitä', 'tasapeli',
  'jenkki', 'spearmint', 'original', 'vihreä', 'punainen', 'sininen', 'keltainen',
  'valkoinen', 'musta', 'harmaa', 'ruskea', 'oranssi', 'violetti', 'vaaleanpunainen',
]);

// Arabic common words
const ARABIC_WORDS = new Set([
  'و', 'في', 'من', 'إلى', 'أن', 'هو', 'هي', 'هم', 'هن', 'نحن',
  'أنا', 'أنت', 'أنتم', 'أنتن', 'ما', 'هذا', 'ذلك', 'التي', 'الذي',
  'كان', 'كانت', 'يكون', 'تكون', 'يكونون', 'تكن', 'كانوا', 'كن',
  'جيد', 'سيء', 'كبير', 'صغير', 'جديد', 'قديم', 'جميل', 'قبيح',
  'سعيد', 'حزين', 'غاضب', 'خائف', 'مسرور', 'حزين', 'مريض', 'صحي',
  'بيت', 'شارع', 'مدينة', 'دولة', 'ماء', 'شجرة', 'زهرة', 'حيوان',
  'إنسان', 'امرأة', 'رجل', 'طفل', 'ولد', 'بنت', 'أم', 'أب',
  'أخ', 'أخت', 'صديق', 'معلم', 'طبيب', 'شرطي', 'جندي', 'طباخ',
  'طعام', 'شراب', 'ماء', 'لحم', 'سمك', 'دجاج', 'بقرة', 'حصان',
  'كلب', 'قطة', 'طير', 'ذبابة', 'نحلة', 'ثعبان', 'سيارة', 'حافلة',
  'قطار', 'طائرة', 'سفينة', 'دراجة', 'دراجة نارية', 'كرة', 'لاعب',
  'لعبة', 'رياضة', 'فوز', 'خسارة', 'تعادل', 'أحمر', 'أزرق', 'أخضر',
  'أصفر', 'أبيض', 'أسود', 'رمادي', 'بني', 'برتقالي', 'بنفسجي',
]);

/**
 * Check if a word is a valid word in any supported language
 */
export function isValidEnglishWord(text: string): boolean {
  if (!text || text.length < 2) return false;
  
  const normalized = text.toLowerCase().trim();
  
  // Check if it's in any dictionary
  if (ENGLISH_WORDS.has(normalized)) return true;
  if (FINNISH_WORDS.has(normalized)) return true;
  if (ARABIC_WORDS.has(normalized)) return true;
  
  // For unknown words, check if they look like real words
  // Allow more lenient validation for brand names and non-dictionary words
  const alphaCount = (normalized.match(/[a-z0-9]/gi) || []).length;
  const totalCount = normalized.length;
  const alphaRatio = alphaCount / totalCount;
  
  // Must be at least 50% alphanumeric (relaxed from 60%)
  if (alphaRatio < 0.5) return false;
  
  // Check if it looks like a real word (not too many special characters)
  const specialCount = (normalized.match(/[^a-z0-9\-']/gi) || []).length;
  if (specialCount > 3) return false;
  
  // If it's 3+ characters and mostly alphanumeric, accept it
  // This allows brand names like "JENKKI"
  if (normalized.length >= 3) return true;
  
  return false;
}

/**
 * Segment text into individual words with positions
 */
export interface WordSegment {
  text: string;
  startIndex: number;
  endIndex: number;
}

export function segmentIntoWords(text: string): WordSegment[] {
  const words: WordSegment[] = [];
  let currentWord = '';
  let startIndex = 0;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isAlpha = /[a-zA-Z0-9'-]/.test(char);
    
    if (isAlpha) {
      if (currentWord === '') {
        startIndex = i;
      }
      currentWord += char;
    } else {
      if (currentWord.length > 0) {
        words.push({
          text: currentWord,
          startIndex,
          endIndex: i
        });
        currentWord = '';
      }
    }
  }
  
  // Add last word if exists
  if (currentWord.length > 0) {
    words.push({
      text: currentWord,
      startIndex,
      endIndex: text.length
    });
  }
  
  return words;
}

/**
 * Filter words to only valid words
 */
export function filterValidWords(words: WordSegment[]): WordSegment[] {
  return words.filter(word => isValidEnglishWord(word.text));
}
