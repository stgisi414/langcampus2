import React, { useState, useEffect, useRef } from 'react';
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
  }

  h1 {
    color: var(--primary-color);
    font-size: 2.5rem;
    margin-bottom: 0;
    font-weight: 700;
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
    overflow-y: auto; /* FIX: Added to allow scrolling for long questions */
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
    word-wrap: break-word; /* FIX: Added to allow long words to wrap */
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
  const supportedLanguages = ['English', 'Spanish', 'French', 'German', 'Japanese', 'Korean'];
  const [showPlayerControls, setShowPlayerControls] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);

  // --- REFS ---
  const playerRef = useRef<YouTubePlayer | null>(null);
  const timeCheckIntervalRef = useRef<number | null>(null);
  const lastPlaybackTimeRef = useRef<number>(0);

  // --- LIFECYCLE ---
  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);
  }, []);
  
  useEffect(() => {
    // Clear any existing interval
    if (timeCheckIntervalRef.current) {
        clearInterval(timeCheckIntervalRef.current);
    }
    // Set a new interval only if the quiz is active and we haven't answered all questions
    if (isQuizActive && currentQuestionIndex < quiz.length) {
        timeCheckIntervalRef.current = window.setInterval(checkPlayerTime, 500);
    }
    // Cleanup function to clear the interval when the component unmounts or dependencies change
    return () => {
        if (timeCheckIntervalRef.current) {
            clearInterval(timeCheckIntervalRef.current);
        }
    };
  }, [isQuizActive, currentQuestionIndex, quiz.length]);

  // --- API & LOGIC ---
  const onPlayerReady = (event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
    setPlayerReady(true);
  };

  const handleSearch = async () => {
    if (!searchTerm) return;
    setLoading(true);
    setError('');
    setSearchResults([]);
    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)} official music video&type=video&maxResults=6&key=${API_KEY}`);
      
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
      if (data.items && data.items.length > 0) {
        setSearchResults(data.items);
        setGameState('RESULTS');
      } else {
        setError('No music videos found for your search. Please try different keywords.');
        setGameState('SEARCH');
      }
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred during search.');
      setGameState('SEARCH'); 
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVideo = (video: YouTubeVideo) => {
    setPlayerReady(false); 
    setSelectedVideo(video);
    setGameState('QUIZ');
  };
  
  const handleStartQuiz = async () => {
    if (!selectedVideo || !isPlayerReady || !playerRef.current) return;
    setLoading(true);
    setError('');

    // Add your Supadata API Key here.
    // You can get a free one from their website.
    const SUPADATA_API_KEY = process.env.SUPADATA_API_KEY; 

    try {
        // --- STEP 1: Fetch Transcript and Video Details in Parallel ---

        const [transcriptResponse, videoDetailsResponse] = await Promise.all([
            // Fetch transcript from Supadata
            fetch(`https://api.supadata.ai/v1/youtube/transcript?videoId=${selectedVideo.id.videoId}`, {
                headers: { 'x-api-key': SUPADATA_API_KEY }
            }),
            // Fetch video details (like description and tags) from YouTube API
            fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${selectedVideo.id.videoId}&key=${API_KEY}`)
        ]);

        // --- STEP 2: Process the API Responses ---

        if (!transcriptResponse.ok) {
            throw new Error('Failed to fetch transcript from Supadata. Check your API key and the video URL.');
        }
        const transcriptData = await transcriptResponse.json();
        // Combine the transcript segments into a single string.
        const fullTranscript = transcriptData.content?.map((segment: { text: string; }) => segment.text).join(' ') || '';

        if (!videoDetailsResponse.ok) {
            throw new Error('Failed to fetch video details from YouTube.');
        }
        const videoDetailsData = await videoDetailsResponse.json();
        const videoSnippet = videoDetailsData.items?.[0]?.snippet || {};
        const videoContentDetails = videoDetailsData.items?.[0]?.contentDetails || {};
        const videoDescription = videoSnippet.description || 'No description available.';
        const videoTags = videoSnippet.tags?.join(', ') || 'No tags available.';
        const videoDuration = videoContentDetails.duration; // ISO 8601 format


        // --- STEP 3: Build the Enhanced Prompt for Gemini ---

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
        
        // This new text prompt includes the transcript and video details.
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

        // --- STEP 4: Generate the Quiz with Gemini ---

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
    lastPlaybackTimeRef.current = currentTime; // Continuously update last known time
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
          setShowEndScreen(true); // <-- ADD THIS LINE
          playerRef.current?.pauseVideo();
        }
    }, 2000); 
  };

  const handleFinishListening = () => {
    // Log the timestamp we are about to use. This is for debugging.
    // You can check your browser's console (F12) to see what this value is.
    console.log(`Attempting to seek to: ${lastPlaybackTimeRef.current}`);

    // These three lines completely exit the quiz UI state.
    setShowEndScreen(false);     // Hides the "Quiz Complete!" screen.
    setIsPausedForQuiz(false);  // Hides the final question overlay.
    
    // This ensures the player is ready before we command it.
    if (playerRef.current && isPlayerReady) {
        // First, seek to the last recorded time.
        playerRef.current.seekTo(lastPlaybackTimeRef.current, true);
        // Then, play the video.
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
    lastPlaybackTimeRef.current = 0; // Reset the stored time
  };

  // --- RENDER ---
  const renderQuizArea = () => {
    const playerOptions = {
        height: '100%',
        width: '100%',
        playerVars: {
          playsinline: 1,
          controls: 1, // Always show controls
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
                    <h2 className="question-text">{currentQuestion.question}</h2>
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

  return (
    <div className="app-container">
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
        <div className="search-container">
          <input
              type="text"
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search songs..."
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              aria-label="Search for a song"
          />
          <button className="search-button" onClick={handleSearch} disabled={loading}>
            {loading ? '...' : 'Search'}
          </button>
        </div>
      )}
      
      <main>
        {renderContent()}
      </main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);