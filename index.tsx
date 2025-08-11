import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from '@google/genai';

// --- STYLES ---
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

  #player {
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

const App: React.FC = () => {
  // --- STATE ---
  const [searchTerm, setSearchTerm] = useState('Lana Del Rey - Video Games');
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isPausedForQuiz, setIsPausedForQuiz] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'SEARCH' | 'RESULTS' | 'QUIZ' | 'END'>('SEARCH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- REFS ---
  const playerRef = useRef<any>(null); // YT.Player
  const timeCheckIntervalRef = useRef<number | null>(null);
  
  // --- LIFECYCLE ---
  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = styles;
    document.head.appendChild(styleTag);

    // Load YouTube IFrame API
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
    }

    (window as any).onYouTubeIframeAPIReady = () => {
        if (selectedVideo) {
            createPlayer(selectedVideo.id.videoId);
        }
    };

    return () => {
      clearInterval(timeCheckIntervalRef.current!);
      (window as any).onYouTubeIframeAPIReady = null;
    }
  }, [selectedVideo]);
  
  useEffect(() => {
    if (isQuizActive && playerRef.current) {
        timeCheckIntervalRef.current = window.setInterval(checkPlayerTime, 500);
    } else {
        clearInterval(timeCheckIntervalRef.current!);
    }
    return () => clearInterval(timeCheckIntervalRef.current!);
  }, [isQuizActive, playerRef.current]);

  // --- API & LOGIC ---
  const createPlayer = (videoId: string) => {
    if (playerRef.current) {
        playerRef.current.destroy();
    }
    playerRef.current = new (window as any).YT.Player('player', {
      videoId: videoId,
      playerVars: {
        'playsinline': 1,
        'controls': 0, // Hide default controls
        'rel': 0,
        'modestbranding': 1,
      },
      events: {
        'onReady': onPlayerReady
      }
    });
  };

  const onPlayerReady = (event: any) => {
    // Player is ready, but we wait for "Start Quiz" to play
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
      setGameState('SEARCH'); // Go back to search on error
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVideo = (video: YouTubeVideo) => {
    setSelectedVideo(video);
    setGameState('QUIZ');
  };
  
  const handleStartQuiz = async () => {
    if (!selectedVideo) return;
    setLoading(true);
    setError('');
    try {
        const schema = {
            type: Type.OBJECT,
            properties: {
                questions: {
                type: Type.ARRAY,
                description: "An array of 5 quiz questions based on the song's lyrics.",
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

        const prompt = `You are a quiz generator for a YouTube music video lyrics game. Given the song title: "${selectedVideo.snippet.title}", generate 5 multiple-choice lyric questions. Provide a timestamp in seconds for when to pause, the preceding lyric, the question itself (as a fill-in-the-blank), 4 options, and the correct answer. Ensure timestamps are spread out and logical for a music video.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });
        
        const quizData = JSON.parse(response.text);
        if (quizData.questions && quizData.questions.length > 0) {
            setQuiz(quizData.questions.sort((a: QuizQuestion, b: QuizQuestion) => a.timestamp - b.timestamp));
            setIsQuizActive(true);
            playerRef.current?.playVideo();
        } else {
            throw new Error("Could not generate a valid quiz. Please try another video.");
        }
    } catch (err: any) {
        setError(err.message || 'Failed to generate quiz. The song might be instrumental or have unclear lyrics.');
        setIsQuizActive(false);
    } finally {
        setLoading(false);
    }
  };

  const checkPlayerTime = () => {
    if (!playerRef.current || !playerRef.current.getCurrentTime || !quiz.length || isPausedForQuiz) return;
    
    const currentTime = playerRef.current.getCurrentTime();
    const currentQuestion = quiz[currentQuestionIndex];

    if (currentQuestion && currentTime >= currentQuestion.timestamp) {
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
        setIsPausedForQuiz(false);

        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex < quiz.length) {
            setCurrentQuestionIndex(nextIndex);
            playerRef.current?.playVideo();
        } else {
            // End of quiz
            setIsQuizActive(false);
            setGameState('END');
            playerRef.current?.stopVideo();
        }
    }, 2000); // 2-second delay to show feedback
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
    if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
    }
  };

  // --- RENDER ---
  const renderContent = () => {
    // This component only renders the main content area, not the persistent search bar or header
    if (loading && gameState !== 'QUIZ') return <div className="loader"></div>;
    
    // Error is now displayed above the main content area for better visibility
    // if (error) return <p className="error-message">{error}</p>;

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
        const currentQuestion = quiz[currentQuestionIndex];
        return (
            <div className="quiz-area">
                <div id="player"></div>
                {loading && (
                    <div className="quiz-overlay visible">
                        <div className="loader"></div>
                        <p>Generating your quiz...</p>
                    </div>
                )}
                {!isQuizActive && !loading && !error && (
                    <div className="quiz-controls">
                        <button className="action-button" onClick={handleStartQuiz}>Start Quiz</button>
                    </div>
                )}
                 {error && !loading && (
                    <div className="quiz-overlay visible">
                        <p className="error-message">{error}</p>
                        <button className="action-button" onClick={handleReset}>Try Another Song</button>
                    </div>
                )}
                {isPausedForQuiz && currentQuestion && (
                    <div className={`quiz-overlay ${isPausedForQuiz ? 'visible' : ''}`}>
                        <p className="preceding-lyric">{currentQuestion.precedingLyric}</p>
                        <h2 className="question-text">{currentQuestion.question}</h2>
                        <div className="options-grid">
                            {currentQuestion.options.map((option, index) => {
                                const isCorrect = option === currentQuestion.correctAnswer;
                                let buttonClass = 'option-button';
                                if (answered) {
                                    if (isCorrect) buttonClass += ' correct';
                                    else if (option !== quiz[currentQuestionIndex].correctAnswer) buttonClass += ' incorrect';
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
            </div>
        );
      case 'END':
        return (
          <div className="final-score">
            <h2>Quiz Complete!</h2>
            <p style={{fontSize: '1.5rem'}}>Your final score is: {score} / {quiz.length}</p>
            <button className="action-button" onClick={handleReset}>Play Another Song</button>
          </div>
        );

      case 'SEARCH':
      default:
        return null; // Search bar and error are handled outside this function
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>LyricFlow Quiz</h1>
      </header>
      
      {gameState !== 'QUIZ' && gameState !== 'END' && (
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for a song or artist..."
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            aria-label="Search for a song"
          />
          <button className="search-button" onClick={handleSearch} disabled={loading}>
            {loading ? '...' : 'Search'}
          </button>
        </div>
      )}

      {error && (gameState === 'SEARCH' || gameState === 'RESULTS') && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
          <p className="error-message" style={{ marginBottom: 0 }}>{error}</p>
          <button className="action-button" onClick={handleReset}>Try Again</button>
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