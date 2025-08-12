import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Part, Type } from '@google/genai';
import YouTube from 'react-youtube';
import type { YouTubePlayer } from 'react-youtube';

// --- STYLES (UPDATED) ---
const styles = `
  .app-container {
    width: 100%;
    max-width: 900px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    min-height: 100vh;
  }

  main {
    flex-grow: 1;
  }

  .header-container {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
  }

  h1 {
    color: var(--primary-color);
    font-size: 2.5rem;
    margin-bottom: 0;
    font-weight: 700;
  }
  
  .help-button {
    background: transparent;
    border: none;
    color: var(--primary-color);
    font-size: 1.5rem;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
  }

  .language-selector-container {
    margin: -1rem 0 1rem 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
  }

  .language-select {
    background-color: var(--surface-color);
    color: var(--text-primary);
    border: 1px solid var(--primary-color);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.9rem;
  }

  .search-container {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
    position: relative;
  }

  .search-input {
    flex-grow: 1;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border-radius: 2rem;
    border: 1px solid var(--surface-color);
    background-color: var(--surface-color);
    color: var(--text-primary);
  }

  .search-button, .action-button {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    border-radius: 2rem;
    border: none;
    background-color: var(--primary-color);
    color: var(--text-primary);
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .search-button:hover, .action-button:hover {
    background-color: #cc0000;
  }

  .finish-listening-button {
    background-color: #333333;
    color: #ff0000;
    border: 1px solid #ff0000;
  }

  .finish-listening-button:hover {
    background-color: #555555;
  }
  
  .loader {
    border: 4px solid var(--surface-color);
    border-top: 4px solid var(--primary-color);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 2rem auto;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-message {
    color: var(--error-color);
    background-color: rgba(244, 67, 54, 0.2);
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
  }

  .video-card {
    background-color: var(--surface-color);
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .video-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.5);
  }

  .video-card img {
    width: 100%;
    aspect-ratio: 16/9;
    object-fit: cover;
  }

  .video-card-title {
    padding: 1rem;
    font-weight: 500;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .quiz-area {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9;
    background-color: #000;
    border-radius: 12px;
    overflow: hidden;
  }

  .youtube-container {
    width: 100%;
    height: 100%;
  }

  .quiz-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 2rem;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s, visibility 0.3s;
    overflow-y: auto;
  }

  .quiz-overlay.visible {
    opacity: 1;
    visibility: visible;
  }

  .preceding-lyric {
    font-size: 1.2rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
    font-style: italic;
  }
  
  .question-text {
    font-size: 1.8rem;
    font-weight: 700;
    margin-bottom: 2rem;
    word-wrap: break-word;
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    width: 100%;
    max-width: 600px;
  }

  .option-button {
    padding: 1rem;
    font-size: 1.1rem;
    border: 2px solid var(--surface-color);
    background-color: transparent;
    color: var(--text-primary);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s, border-color 0.2s;
  }

  .option-button:hover:not(:disabled) {
    background-color: var(--surface-color);
  }

  .option-button.correct {
    background-color: var(--success-color);
    border-color: var(--success-color);
  }

  .option-button.incorrect {
    background-color: var(--error-color);
    border-color: var(--error-color);
  }

  .option-button:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
  
  .tts-button {
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    font-size: 1.2rem;
    margin-left: 0.5rem;
    vertical-align: middle;
    transition: color 0.2s;
  }

  .tts-button:hover {
    color: var(--primary-color);
  }

  .quiz-controls {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
  }
  
  .final-score {
    text-align: center;
  }

  .final-score h2 {
    font-size: 2.5rem;
    color: var(--primary-color);
  }
  
  .button-container {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  /* NEW: Help Popup Styles */
  .help-popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
  }
  
  .help-popup-content {
    background-color: var(--surface-color);
    color: var(--text-primary);
    padding: 2rem;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    text-align: left;
    position: relative;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }
  
  .help-popup-content h3 {
    text-align: center;
    color: var(--primary-color);
    margin-top: 0;
  }
  
  .help-popup-content p {
    margin-bottom: 1rem;
  }
  
  .help-popup-close-button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: transparent;
    border: none;
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--text-secondary);
    cursor: pointer;
  }
  
  /* NEW: Dropdown styles */
  .search-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    background-color: var(--surface-color);
    border: 1px solid var(--primary-color);
    border-radius: 8px;
    margin-top: 0.5rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    list-style-type: none;
    padding: 0;
    max-height: 200px;
    overflow-y: auto;
  }
  .search-dropdown h4 {
    margin: 0;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
    text-align: left;
    border-bottom: 1px solid var(--primary-color);
  }
  .search-dropdown-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.15s;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .search-dropdown-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  .search-dropdown-clear {
    padding: 0.5rem 1rem;
    cursor: pointer;
    text-align: center;
    color: var(--primary-color);
    font-size: 0.9rem;
    border-top: 1px solid var(--primary-color);
    margin-top: 0;
  }
  
  /* NEW: Footer styles */
  .app-footer {
    width: 100%;
    text-align: center;
    padding: 1rem;
    background-color: var(--surface-color);
    color: var(--text-secondary);
    font-size: 0.9rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .footer-logo {
    height: 1.2em;
    vertical-align: middle;
  }
`;

// --- TYPES ---
interface YouTubeVideo {
  id: { videoId: string };
  snippet: {
    title: string;
    thumbnails: {
      high: { url: string };
    };
  };
}

interface QuizQuestion {
  timestamp: number;
  precedingLyric: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

// --- API CLIENT ---
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- UTILITY FUNCTIONS ---
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// --- NEW: Local Storage Key ---
const SEARCH_HISTORY_KEY = 'langcampus_search_history';

// --- NEW: A simple, safe parser for the YouTube autocomplete API response ---
const parseYouTubeSuggestions = (text: string): string[] => {
  try {
    const startIndex = text.indexOf('window.google.ac.h(') + 'window.google.ac.h('.length;
    const endIndex = text.lastIndexOf(')');
    const jsonString = text.substring(startIndex, endIndex);
    const data = JSON.parse(jsonString);
    if (data && Array.isArray(data[1])) {
      return data[1].map((item: any) => item[0]);
    }
  } catch (e) {
    console.error('Failed to parse YouTube suggestions:', e);
  }
  return [];
};

// NEW: Helper function to decode base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// NEW: Utility to wrap PCM audio data in a WAV container
const pcmToWav = (pcmData: ArrayBuffer): Blob => {
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false);
  // file length
  view.setUint32(4, pcmData.byteLength + 36, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false);
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false);
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, 24000, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, 24000 * 2, true);
  // block align (channels * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false);
  // data chunk length
  view.setUint32(40, pcmData.byteLength, true);

  const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
  return wavBlob;
};

// NEW: Help Popup Component
const HelpPopup: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="help-popup-overlay">
    <div className="help-popup-content">
      <button className="help-popup-close-button" onClick={onClose}>×</button>
      <h3>How to Get the Best Results</h3>
      <p>
        This quiz app uses the video's transcript to generate questions. For the best experience, we recommend choosing songs that are:
      </p>
      <ul>
        <li>Official music videos or official lyric videos.</li>
        <li>Videos that have built-in captions (subtitles).</li>
        <li>Videos where the lyrics are displayed on screen, synchronized with the music.</li>
      </ul>
      <p>
        Using these types of videos ensures the most accurate and high-quality quiz questions will be generated.
      </p>
    </div>
  </div>
);

// NEW: Maps friendly language names to BCP-47 codes and prebuilt voices
const languageCodeMap = {
  'English': 'en-US',
  'Spanish': 'es-US',
  'French': 'fr-FR',
  'German': 'de-DE',
  'Japanese': 'ja-JP',
  'Korean': 'ko-KR',
  'Italian': 'it-IT',
  'Portuguese': 'pt-BR',
  'Russian': 'ru-RU',
  'Arabic': 'ar-EG',
  'Chinese': 'zh-CN',
  'Hindi': 'hi-IN',
  'Turkish': 'tr-TR',
  'Polish': 'pl-PL',
  'Dutch': 'nl-NL',
  'Swedish': 'sv-SE',
  'Finnish': 'fi-FI',
};
const voiceConfigMap = {
    'en-US': { prebuiltVoiceConfig: { voiceName: 'Kore' } },
    'es-US': { prebuiltVoiceConfig: { voiceName: 'Puck' } },
    'fr-FR': { prebuiltVoiceConfig: { voiceName: 'Leda' } },
    'de-DE': { prebuiltVoiceConfig: { voiceName: 'Charon' } },
    'ja-JP': { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
    'ko-KR': { prebuiltVoiceConfig: { voiceName: 'Orus' } },
    'it-IT': { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
    'pt-BR': { prebuiltVoiceConfig: { voiceName: 'Umbriel' } },
    'ru-RU': { prebuiltVoiceConfig: { voiceName: 'Iapetus' } },
    'ar-EG': { prebuiltVoiceConfig: { voiceName: 'Algieba' } },
    'zh-CN': { prebuiltVoiceConfig: { voiceName: 'Achernar' } },
    'hi-IN': { prebuiltVoiceConfig: { voiceName: 'Alnilam' } },
    'tr-TR': { prebuiltVoiceConfig: { voiceName: 'Gacrux' } },
    'pl-PL': { prebuiltVoiceConfig: { voiceName: 'Pulcherrima' } },
    'nl-NL': { prebuiltVoiceConfig: { voiceName: 'Achird' } },
    'sv-SE': { prebuiltVoiceConfig: { voiceName: 'Zubenelgenubi' } },
    'fi-FI': { prebuiltVoiceConfig: { voiceName: 'Vindemiatrix' } },
};

// NEW: Footer component
const Footer: React.FC<{ onHelpClick: () => void }> = ({ onHelpClick }) => (
  <footer className="app-footer">
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span>(c) <span style={{ color: 'white' }} >Langcampus</span> powered by</span>
      <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        <img src="/gemini_logo.png" alt="Gemini" className="footer-logo" /> Gemini
      </a>
      <span>and</span>
      <a href="youtu.be" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        <img src="/youtube_logo.png" alt="YouTube" className="footer-logo" /> YouTube
      </a>
    </div>
    <button className="help-button" onClick={onHelpClick}>?</button>
  </footer>
);


const App: React.FC = () => {
  // --- STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isPausedForQuiz, setIsPausedForQuiz] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'SEARCH' | 'RESULTS' | 'QUIZ' | 'END' | 'POST_QUIZ_PLAYBACK'>('SEARCH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPlayerReady, setPlayerReady] = useState(false);
  const [language, setLanguage] = useState('English');
  const supportedLanguages = Object.keys(languageCodeMap);
  const [showPlayerControls, setShowPlayerControls] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [showHelpPopup, setShowHelpPopup] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [predictiveSuggestions, setPredictiveSuggestions] = useState<string[]>([]);
  const [isHistoryDropdown, setIsHistoryDropdown] = useState(true);
  const [audioCache, setAudioCache] = useState<Record<string, HTMLAudioElement>>({});
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // --- REFS ---
  const playerRef = useRef<YouTubePlayer | null>(null);
  const timeCheckIntervalRef = useRef<number | null>(null);
  const lastPlaybackTimeRef = useRef<number>(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const fetchSuggestionsAbortControllerRef = useRef<AbortController | null>(null);

  // --- LIFECYCLE ---
  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);
    
    try {
        const storedHistory = localStorage.getItem(SEARCH_HISTORY_KEY);
        if (storedHistory) {
            setSearchHistory(JSON.parse(storedHistory));
        }
    } catch (e) {
        console.error("Could not load search history from local storage:", e);
    }
  }, []);
  
  useEffect(() => {
    if (timeCheckIntervalRef.current) {
        clearInterval(timeCheckIntervalRef.current);
    }
    if (isQuizActive && currentQuestionIndex < quiz.length) {
        timeCheckIntervalRef.current = window.setInterval(checkPlayerTime, 500);
    }
    return () => {
        if (timeCheckIntervalRef.current) {
            clearInterval(timeCheckIntervalRef.current);
        }
    };
  }, [isQuizActive, currentQuestionIndex, quiz.length]);

  useEffect(() => {
    if (fetchSuggestionsAbortControllerRef.current) {
        fetchSuggestionsAbortControllerRef.current.abort();
    }
    
    if (searchTerm.length > 1) {
      console.log(`[Predictive Search Log]: Search term changed to "${searchTerm}". Debouncing API call.`);
      setIsHistoryDropdown(false);

      const controller = new AbortController();
      fetchSuggestionsAbortControllerRef.current = controller;
      
      const timeoutId = setTimeout(async () => {
          try {
              const url = `/suggest/complete/search?client=youtube&gs_ri=youtube&ds=yt&q=${encodeURIComponent(searchTerm)}`;
              console.log(`[Predictive Search Log]: Making API call to ${url}`);
              const response = await fetch(url, { signal: controller.signal });
              
              if (!response.ok) {
                  throw new Error(`API call failed with status: ${response.status}`);
              }
              
              const text = await response.text();
              console.log('[Predictive Search Log]: API response received.');
              console.log('[Predictive Search Log]: Raw response text:', text.substring(0, 100) + '...');
              
              const suggestions = parseYouTubeSuggestions(text);
              console.log('[Predictive Search Log]: Parsed suggestions:', suggestions);
              setPredictiveSuggestions(suggestions);
          } catch (e: any) {
              if (e.name !== 'AbortError') {
                  console.error('[Predictive Search Log]: Failed to fetch or parse suggestions:', e);
              }
          }
      }, 300);

      return () => clearTimeout(timeoutId);

    } else {
        console.log(`[Predictive Search Log]: Search term is too short or empty. Reverting to history dropdown.`);
        setIsHistoryDropdown(true);
        setPredictiveSuggestions([]);
    }
  }, [searchTerm]);

  useEffect(() => {
      try {
          localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
      } catch (e) {
          console.error("Could not save search history to local storage:", e);
      }
  }, [searchHistory]);

  // --- API & LOGIC ---
  const onPlayerReady = (event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
    setPlayerReady(true);
  };
  
  const addSearchToHistory = (term: string) => {
    const trimmedTerm = term.trim();
    if (trimmedTerm && !searchHistory.includes(trimmedTerm)) {
      setSearchHistory(prevHistory => {
        const newHistory = [trimmedTerm, ...prevHistory.filter(t => t !== trimmedTerm)];
        return newHistory.slice(0, 10);
      });
    }
  };

  const handleSearch = useCallback(async (term: string) => {
    if (!term) return;
    setLoading(true);
    setError('');
    setSearchResults([]);
    setShowDropdown(false);
    
    addSearchToHistory(term);
    setSearchTerm(term);

    try {
      console.log(`[Search Log]: Initiating video search for "${term}"`);
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(term)} official music video&type=video&maxResults=6&key=${API_KEY}`);
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch videos from YouTube (Status: ${response.status}).`;
        try {
            const errorData = await response.json();
            if (errorData?.error?.message) {
                errorMessage = `YouTube API Error: ${errorData.error.message}`;
            }
        } catch (e) {
            console.error("Failed to parse YouTube API error response", e);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[Search Log]: Video search API response received:', data.items);
      if (data.items && data.items.length > 0) {
        setSearchResults(data.items);
        setGameState('RESULTS');
      } else {
        setError('No music videos found for your search. Please try different keywords.');
        setGameState('SEARCH');
      }
    } catch (err: any) {
      console.error('[Search Log]: An error occurred during the video search:', err);
      setError(err.message || 'An unknown error occurred during search.');
      setGameState('SEARCH'); 
    } finally {
      setLoading(false);
    }
  }, [API_KEY]);

  const handleSelectVideo = (video: YouTubeVideo) => {
    setPlayerReady(false); 
    setSelectedVideo(video);
    setGameState('QUIZ');
  };
  
  const handleStartQuiz = async () => {
    if (!selectedVideo || !isPlayerReady || !playerRef.current) return;
    setLoading(true);
    setError('');

    const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY; 

    try {
        const [transcriptResponse, videoDetailsResponse] = await Promise.all([
            fetch(`https://api.supadata.ai/v1/youtube/transcript?videoId=${selectedVideo.id.videoId}`, {
                headers: { 'x-api-key': SUPADATA_API_KEY }
            }),
            fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${selectedVideo.id.videoId}&key=${API_KEY}`)
        ]);

        if (!transcriptResponse.ok) {
            throw new Error('Failed to fetch transcript from Supadata. Check your API key and the video URL.');
        }
        const transcriptData = await transcriptResponse.json();
        const fullTranscript = transcriptData.content?.map((segment: { text: string; }) => segment.text).join(' ') || '';

        if (!videoDetailsResponse.ok) {
            throw new Error('Failed to fetch video details from YouTube.');
        }
        const videoDetailsData = await videoDetailsResponse.json();
        const videoSnippet = videoDetailsData.items?.[0]?.snippet || {};
        const videoContentDetails = videoDetailsData.items?.[0]?.contentDetails || {};
        const videoDescription = videoSnippet.description || 'No description available.';
        const videoTags = videoSnippet.tags?.join(', ') || 'No tags available.';
        const videoDuration = videoContentDetails.duration;

        const videoUrl = `https://www.youtube.com/watch?v=${selectedVideo.id.videoId}`;
        
        const schema = {
            type: Type.OBJECT,
            properties: {
                questions: {
                    type: Type.ARRAY,
                    description: "An array of quiz questions based on the song's lyrics, including timestamps.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            timestamp: { type: Type.INTEGER, description: "Time in seconds to pause the video for the question." },
                            precedingLyric: { type: Type.STRING, description: "The lyric line immediately before the question." },
                            question: { type: Type.STRING, description: "The lyric with a blank to be filled (e.g., '...to the old town ____')." },
                            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of 4 multiple-choice options." },
                            correctAnswer: { type: Type.STRING, description: "The correct answer from the options." },
                        },
                        required: ["timestamp", "precedingLyric", "question", "options", "correctAnswer"],
                    },
                },
            },
            required: ["questions"],
        };

        const videoPart: Part = {
            fileData: {
                mimeType: 'video/youtube',
                fileUri: videoUrl
            }
        };
        
        const textPart: Part = {
            text: `Please create a fill-in-the-blank lyrics quiz for the provided music video.
            
            Here is additional context for the video:
            - Video Title: "${selectedVideo.snippet.title}"
            - Video Description: "${videoDescription}"
            - Video Tags: "${videoTags}"
            - Full Song Transcript: "${fullTranscript}"
            - Video Duration: ${videoDuration}

            IMPORTANT INSTRUCTIONS:
            1.  Base the quiz questions *directly* on the provided transcript.
            2.  Generate as many high-quality questions as possible and distribute them evenly throughout the song.
            3.  Provide an accurate timestamp (in seconds) from the video for when each question should appear. The final timestamp MUST be less than the video's total duration.
            4.  The user's chosen language is ${language}. Generate the entire quiz (preceding lyric, question, and all options) in ${language}.
            5.  Ensure all four options for each question are unique and one is clearly the correct answer from the lyrics.
            6.  FIX: EXTREMELY IMPORTANT: Only use lyrics that are in the user's chosen language of ${language}. Do not create any questions or options from lyrics in other languages, even if they appear in the transcript. This is to ensure the quiz is relevant and in the correct language.`
        };

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ parts: [videoPart, textPart] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });
        
        const quizData: { questions: QuizQuestion[] } = JSON.parse(response.text);

        if (quizData.questions && quizData.questions.length > 0) {
            const processedQuiz = quizData.questions.map(q => ({
                ...q,
                options: shuffleArray(q.options)
            })).sort((a, b) => a.timestamp - b.timestamp);
            
            setQuiz(processedQuiz);
            setIsQuizActive(true);
            playerRef.current?.playVideo();
        } else {
            throw new Error("Could not generate a valid quiz from the video. The transcript might be unavailable.");
        }
    } catch (err: any) {
        setError(err.message || 'Failed to generate quiz. The AI may not have been able to analyze this video.');
        setIsQuizActive(false);
    } finally {
        setLoading(false);
    }
  };

  const checkPlayerTime = async () => {
    if (!playerRef.current || !isPlayerReady || isPausedForQuiz) {
      return;
    }

    const currentTime = Number(await playerRef.current.getCurrentTime());
    lastPlaybackTimeRef.current = currentTime;
    const currentQuestion = quiz[currentQuestionIndex];

    if (!currentQuestion) {
      setIsQuizActive(false); 
      return;
    }

    if (currentTime >= currentQuestion.timestamp) {
      playerRef.current.pauseVideo();
      setIsPausedForQuiz(true);
    }
};
  
  const handleAnswer = (option: string) => {
    if (answered) return;
    setAnswered(true);

    if(option === quiz[currentQuestionIndex].correctAnswer) {
      setScore(s => s + 1);
    }

    setTimeout(() => {
        setAnswered(false);
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex < quiz.length) {
          setCurrentQuestionIndex(nextIndex);
          setIsPausedForQuiz(false); 
          playerRef.current?.playVideo();
        } else {
          setIsQuizActive(false);
          setGameState('END');
          setShowEndScreen(true);
          playerRef.current?.pauseVideo();
        }
    }, 2000); 
  };

  const handleFinishListening = () => {
    console.log(`Attempting to seek to: ${lastPlaybackTimeRef.current}`);

    setShowEndScreen(false);
    setIsPausedForQuiz(false);
    
    if (playerRef.current && isPlayerReady) {
        playerRef.current.seekTo(lastPlaybackTimeRef.current, true);
        playerRef.current.playVideo();
    }
  };
  
  const handleReset = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSelectedVideo(null);
    setQuiz([]);
    setCurrentQuestionIndex(0);
    setIsQuizActive(false);
    setIsPausedForQuiz(false);
    setAnswered(false);
    setScore(0);
    setGameState('SEARCH');
    setError('');
    lastPlaybackTimeRef.current = 0;
  };
  
  const handleClearHistory = () => {
    setSearchHistory([]);
    setShowDropdown(false);
  };
  
  const playAudio = async (text: string, lang: string) => {
    if (isAudioPlaying) {
      return;
    }
    const audioKey = `${text}-${lang}`;
    if (audioCache[audioKey]) {
      setIsAudioPlaying(true);
      audioCache[audioKey].play();
      audioCache[audioKey].onended = () => {
        setIsAudioPlaying(false);
      };
      return;
    }

    try {
      const languageCode = languageCodeMap[lang];
      if (!languageCode) {
        console.error('Unsupported language for TTS:', lang);
        return;
      }
      const voiceConfig = voiceConfigMap[languageCode] || voiceConfigMap['en-US'];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            ...voiceConfig,
            languageCode: languageCode
          },
        },
      });

      console.log('[TTS Log]: Full API response:', response);

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (data) {
        const audioBuffer = base64ToArrayBuffer(data);
        const audioBlob = pcmToWav(audioBuffer);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsAudioPlaying(false);
        };
        
        audio.play();
        setIsAudioPlaying(true);
        
        setAudioCache(prevCache => ({
          ...prevCache,
          [audioKey]: audio
        }));
      } else {
        console.error('No audio data received from TTS API.');
      }
    } catch (e) {
      console.error('Failed to generate or play audio:', e);
      setIsAudioPlaying(false);
    }
  };

  const renderQuizArea = () => {
    const playerOptions = {
        height: '100%',
        width: '100%',
        playerVars: {
          playsinline: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
        },
    };

    const currentQuestion = quiz[currentQuestionIndex];

    return (
        <div className="quiz-area">
            {selectedVideo && (
                <YouTube
                    videoId={selectedVideo.id.videoId}
                    opts={playerOptions}
                    onReady={onPlayerReady}
                    className="youtube-container"
                />
            )}
            
            {loading && gameState === 'QUIZ' && (
                <div className="quiz-overlay visible">
                    <div className="loader"></div>
                    <p>Generating your quiz...</p>
                </div>
            )}
            
            {!isQuizActive && gameState === 'QUIZ' && !loading && !error && (
                <div className="quiz-controls">
                     <button className="action-button" onClick={handleStartQuiz} disabled={!isPlayerReady || loading}>
                        {isPlayerReady ? 'Start Quiz' : 'Player Loading...'}
                     </button>
                </div>
            )}
            
             {error && gameState !== 'POST_QUIZ_PLAYBACK' && (
                <div className="quiz-overlay visible">
                    <p className="error-message">{error}</p>
                    <button className="action-button" onClick={handleReset}>Try Another Song</button>
                </div>
            )}

            {isPausedForQuiz && currentQuestion && gameState !== 'POST_QUIZ_PLAYBACK' && (
                <div className={`quiz-overlay visible`}>
                    <p>Question {currentQuestionIndex + 1} of {quiz.length}</p>
                    <p className="preceding-lyric">{currentQuestion.precedingLyric}</p>
                    <h2 className="question-text">
                      {currentQuestion.question}
                      <button className="tts-button" onClick={() => playAudio(currentQuestion.question, language)} disabled={isAudioPlaying}>
                        🔊
                      </button>
                    </h2>
                    <div className="options-grid">
                        {currentQuestion.options.map((option, index) => {
                            const isCorrect = option === currentQuestion.correctAnswer;
                            let buttonClass = 'option-button';
                            if (answered) {
                                if (isCorrect) buttonClass += ' correct';
                                else buttonClass += ' incorrect';
                            }
                            return (
                                <button 
                                    key={index} 
                                    className={buttonClass}
                                    onClick={() => handleAnswer(option)}
                                    disabled={answered}
                                >
                                    {option}
                                    <button 
                                      className="tts-button" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        playAudio(option, language);
                                      }}
                                      disabled={isAudioPlaying}
                                    >
                                      🔊
                                    </button>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {gameState === 'END' && showEndScreen && (
                <div className="quiz-overlay visible">
                    <div className="final-score">
                        <h2>Quiz Complete!</h2>
                        <p style={{fontSize: '1.5rem'}}>Your final score is: {score} / {quiz.length}</p>
                        <div className="button-container">
                            <button className="action-button" onClick={handleReset}>Play Another Song</button>
                            <button className="action-button finish-listening-button" onClick={handleFinishListening}>Finish Listening</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  }

  const renderContent = () => {
    if (loading && (gameState === 'SEARCH' || gameState === 'RESULTS')) {
      return <div className="loader"></div>;
    }
    
    switch (gameState) {
      case 'RESULTS':
        return (
          <div className="results-grid">
            {searchResults.map((video) => (
              <div key={video.id.videoId} className="video-card" onClick={() => handleSelectVideo(video)}>
                <img src={video.snippet.thumbnails.high.url} alt={video.snippet.title} />
                <p className="video-card-title">{video.snippet.title}</p>
              </div>
            ))}
          </div>
        );
      case 'QUIZ':
      case 'END':
      case 'POST_QUIZ_PLAYBACK':
        return renderQuizArea();

      case 'SEARCH':
      default:
        return error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
            <p className="error-message" style={{ marginBottom: 0 }}>{error}</p>
            <button className="action-button" onClick={handleReset}>Try Again</button>
          </div>
        ); 
    }
  };

  const handleDropdownItemClick = (term: string) => {
    handleSearch(term);
    setSearchTerm(term);
  };
  
  return (
    <div className="app-container">
      {showHelpPopup && <HelpPopup onClose={() => setShowHelpPopup(false)} />}
      <header onClick={handleReset} style={{ cursor: 'pointer' }}>
        <h1 style={{ letterSpacing: '-0.09925em' }}><img src="/logo.png" style={{ height: '45px', width: '45px5px', background: 'rgba(256, 256, 256, 1)', borderRadius: '50%', padding: '3px', border: '2px solid #ff0000', verticalAlign: 'middle', marginRight: '5px'}} />Langcampus</h1>
      </header>

      <div className="language-selector-container">
        <label htmlFor="language-select">Quiz Language: </label>
        <select
          id="language-select"
          className="language-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={gameState === 'QUIZ' || gameState === 'END' || gameState === 'POST_QUIZ_PLAYBACK'}
        >
          {supportedLanguages.map(lang => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
      </div>
      
      {(gameState === 'SEARCH' || gameState === 'RESULTS') && (
        <div className="search-container" ref={searchContainerRef}>
          <input
              type="text"
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search songs..."
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
              aria-label="Search for a song"
              onFocus={() => setShowDropdown(true)}
              onBlur={(e) => {
                setTimeout(() => {
                  if (!searchContainerRef.current?.contains(document.activeElement)) {
                    setShowDropdown(false);
                  }
                }, 100);
              }}
          />
          <button className="search-button" onClick={() => handleSearch(searchTerm)} disabled={loading}>
            {loading ? '...' : 'Search'}
          </button>
          {showDropdown && (predictiveSuggestions.length > 0 || searchHistory.length > 0) && (
            <ul className="search-dropdown">
              {isHistoryDropdown ? (
                <>
                  <h4 style={{ color: 'var(--text-secondary)' }}>Recent Searches</h4>
                  {searchHistory.map((historyItem, index) => (
                    <li
                      key={index}
                      className="search-dropdown-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleDropdownItemClick(historyItem);
                      }}
                    >
                      {historyItem}
                    </li>
                  ))}
                  <li className="search-dropdown-clear" onClick={handleClearHistory}>
                      Clear History
                  </li>
                </>
              ) : (
                <>
                  <h4 style={{ color: 'var(--text-secondary)' }}>Suggestions</h4>
                  {predictiveSuggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="search-dropdown-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleDropdownItemClick(suggestion);
                      }}
                    >
                      {suggestion}
                    </li>
                  ))}
                </>
              )}
            </ul>
          )}
        </div>
      )}
      
      <main>
        {renderContent()}
      </main>
      <Footer onHelpClick={() => setShowHelpPopup(true)} />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);