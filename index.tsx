import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { GoogleGenAI, Part, Type } from "@google/genai";
import YouTube from "react-youtube";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import type { YouTubePlayer } from "react-youtube";

// --- STYLES (UPDATED) ---
const styles = `
  .app-container {
    position: relative;
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
  .search-button-icon {
    display: none; /* Hidden by default on large screens */
    font-size: 1.2rem; /* Makes the magnifying glass a nice size */
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
    background-color: rgba(0, 0, 0, 0.99);
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
  
  .tts-button, .translate-button {
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    font-size: 1.2rem;
    margin-left: 0.5rem;
    vertical-align: middle;
    transition: color 0.2s;
  }

  .tts-button:hover, .translate-button {
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

  .landing-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3rem;
    margin-top: 3rem;
    margin-bottom: 2rem;
    padding: 0 1rem;
    animation: fadeIn 0.5s ease-in-out;
  }

  .landing-image {
    max-width: 45%;
    height: auto;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  }

  .landing-content {
    flex: 1;
    text-align: left;
  }

  .landing-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 1rem;
  }

  .landing-text {
    font-size: 1.2rem;
    color: var(--text-secondary);
    max-width: 600px;
    line-height: 1.6;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .popular-songs-container {
    width: 100%;
    margin-top: 3rem;
    border-top: 1px solid var(--surface-color);
    padding-top: 2rem;
  }

  .popular-songs-title {
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
  }

  .popular-songs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1.5rem;
  }

  @media (max-width: 768px) {
    .landing-container {
      flex-direction: column;
      gap: 2rem;
    }

    .landing-image {
      max-width: 100%;
      width: 500px; 
      order: 2;
    }

    .landing-content {
      order: 1;
      text-align: center;
    }

    .landing-title {
      font-size: 2.2rem;
    }

    .landing-text {
      font-size: 1.1rem;
    }
  }

  .app-logo {
    animation: logo-animation 3.5s ease-in-out;
    display: inline-block;
  }

  @keyframes logo-animation {
    0% {
      transform: scale(1);
      opacity: 1;
      margin-right: 5px;
    }
    20% {
      transform: scale(2.0);
      margin-right: 40px; 
    }
    35%, 65% {
      transform: scale(2.2);
      margin-right: 45px;
    }
    50% {
      transform: scale(1.9);
      margin-right: 38px;
    }
    85% {
      transform: scale(1);
      opacity: 1;
      margin-right: 5px;
    }
    92% {
      opacity: 0.2;
    }
    100% {
      transform: scale(1);
      opacity: 1;
      margin-right: 5px;
    }
  }
  
   .landscape-notifier {
    display: none;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.5rem;
    margin-top: 1rem;
    color: #9e9e9e;
    animation: pulse 2.5s infinite ease-in-out;
  }

  .landscape-notifier .material-symbols-outlined {
    font-family: 'Material Symbols Outlined';
    font-size: 40px;
    width: 40px;
    height: 40px;
    color: #9e9e9e;
    line-height: 1;
    text-align: center;
    user-select: none;
    -webkit-user-select: none;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
  }

  @media (max-width: 768px) and (orientation: portrait) {
    .landscape-notifier {
      display: flex;
    }
     .options-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 600px) {
    .app-footer {
      flex-direction: row; 
      align-items: center; 
      gap: 1rem;
    }
    .footer-credits {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
    .footer-logos {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .help-button {
      margin-left: 0;
      margin-top: 0.5rem;
    }
    .search-button {
      padding: 0.75rem;
      width: 44px;
      height: 44px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .search-button-text {
      display: none;
    }
    .search-button-icon {
      display: inline;
    }
  }

  .auth-container {
    position: absolute;
    top: -0.5rem;
    right: 2rem;
    z-index: 100;
  }

  .user-profile-button {
    width: 45px;
    height: 45px;
    border-radius: 50%;
    padding: 0;
    background-size: cover;
    background-position: center;
    cursor: pointer;
  }

  .user-profile-button:hover {
    border-color: var(--primary-color);
  }

  .user-profile-button img {
    width: 41px;
    height: 41px;
    margin-left: -1px;
    border-radius: 50%;
  }

  .auth-dropdown {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    background-color: var(--surface-color);
    border: 1px solid #444;
    border-radius: 8px;
    padding: 0.75rem;
    width: 220px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .auth-dropdown label {
    font-size: 0.9rem;
    color: var(--text-secondary);
    text-align: left;
  }
  
  .native-lang-select {
    background-color: #333;
    color: var(--text-primary);
    border: 1px solid #555;
    border-radius: 4px;
    padding: 0.5rem;
    width: 100%;
    font-size: 1rem;
  }
  
  .native-lang-select:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .logout-button {
    background-color: var(--primary-color);
    color: var(--text-primary);
    border: none;
    border-radius: 4px;
    padding: 0.6rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .logout-button:hover {
    background-color: #cc0000;
  }

  .login-button {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1.5rem;
    font-size: 1rem;
    font-family: 'Roboto', sans-serif;
    font-weight: 500;
    background-color: #4285F4;
    color: #ffffff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .login-button:hover {
    background-color: #357ae8;
  }
  .login-button svg {
    width: 24px;
    height: 24px;
  }
`;

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAmyABNtvXOzpl0_O4s7-6rZQT-rNk5szg",
  authDomain: "langcampus-v2-96af4.firebaseapp.com",
  projectId: "langcampus-v2-96af4",
  storageBucket: "langcampus-v2-96af4.firebasestorage.app",
  messagingSenderId: "999949510081",
  appId: "1:999949510081:web:3101f8a25c35a8c1c7bb40",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

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

// --- UTILITY FUNCTIONS ---
const parseISO8601Duration = (duration: string): number => {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;

  return hours * 3600 + minutes * 60 + seconds;
};

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// --- NEW: Local Storage Key ---
const SEARCH_HISTORY_KEY = "langcampus_search_history";

// --- NEW: A simple, safe parser for the YouTube autocomplete API response ---
const parseYouTubeSuggestions = (data: any): string[] => {
  try {
    if (data && Array.isArray(data.items)) {
      // The official API returns a list of video objects. We map them to their titles.
      return data.items.map((item: any) => item.snippet.title);
    }
  } catch (e) {
    console.error("Failed to parse YouTube suggestions:", e);
  }
  return [];
};

// NEW: Help Popup Component
const HelpPopup: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="help-popup-overlay">
    <div className="help-popup-content">
      <button className="help-popup-close-button" onClick={onClose}>
        ×
      </button>
      <h3>How to Get the Best Results</h3>
      <p>
        This quiz app uses the video's transcript to generate questions. For the
        best experience, we recommend choosing songs that are:
      </p>
      <ul>
        <li>Official music videos or official lyric videos.</li>
        <li>Videos that have built-in captions (subtitles).</li>
        <li>
          Videos where the lyrics are displayed on screen, synchronized with the
          music.
        </li>
      </ul>
      <p>
        Using these types of videos ensures the most accurate and high-quality
        quiz questions will be generated.
      </p>
      <p>
        For mobile users, you will not be able to answer quiz questions without
        turning your phone sideways and accessing the website in landscape mode.
      </p>
    </div>
  </div>
);

// NEW: Maps friendly language names to BCP-47 codes and prebuilt voices
const languageCodeMap = {
  English: "en-US",
  Spanish: "es-US",
  French: "fr-FR",
  German: "de-DE",
  Japanese: "ja-JP",
  Korean: "ko-KR",
  Italian: "it-IT",
  Portuguese: "pt-BR",
  Russian: "ru-RU",
  Arabic: "ar-EG",
  Chinese: "zh-CN",
  Hindi: "hi-IN",
  Turkish: "tr-TR",
  Polish: "pl-PL",
  Dutch: "nl-NL",
  Swedish: "sv-SE",
  Finnish: "fi-FI",
};
const voiceConfigMap = {
  "en-US": { prebuiltVoiceConfig: { voiceName: "Kore" } },
  "es-US": { prebuiltVoiceConfig: { voiceName: "Puck" } },
  "fr-FR": { prebuiltVoiceConfig: { voiceName: "Leda" } },
  "de-DE": { prebuiltVoiceConfig: { voiceName: "Charon" } },
  "ja-JP": { prebuiltVoiceConfig: { voiceName: "Aoede" } },
  "ko-KR": { prebuiltVoiceConfig: { voiceName: "Orus" } },
  "it-IT": { prebuiltVoiceConfig: { voiceName: "Fenrir" } },
  "pt-BR": { prebuiltVoiceConfig: { voiceName: "Umbriel" } },
  "ru-RU": { prebuiltVoiceConfig: { voiceName: "Iapetus" } },
  "ar-EG": { prebuiltVoiceConfig: { voiceName: "Algieba" } },
  "zh-CN": { prebuiltVoiceConfig: { voiceName: "Achernar" } },
  "hi-IN": { prebuiltVoiceConfig: { voiceName: "Alnilam" } },
  "tr-TR": { prebuiltVoiceConfig: { voiceName: "Gacrux" } },
  "pl-PL": { prebuiltVoiceConfig: { voiceName: "Pulcherrima" } },
  "nl-NL": { prebuiltVoiceConfig: { voiceName: "Achird" } },
  "sv-SE": { prebuiltVoiceConfig: { voiceName: "Zubenelgenubi" } },
  "fi-FI": { prebuiltVoiceConfig: { voiceName: "Vindemiatrix" } },
};
const languageToFlagMap: Record<string, string> = {
  English: "🇺🇸",
  Spanish: "🇪🇸",
  French: "🇫🇷",
  German: "🇩🇪",
  Japanese: "🇯🇵",
  Korean: "🇰🇷",
  Italian: "🇮🇹",
  Portuguese: "🇧🇷",
  Russian: "🇷🇺",
  Arabic: "🇪🇬",
  Chinese: "🇨🇳",
  Hindi: "🇮🇳",
  Turkish: "🇹🇷",
  Polish: "🇵🇱",
  Dutch: "🇳🇱",
  Swedish: "🇸🇪",
  Finnish: "🇫🇮",
};

const TranslationPopup: React.FC<{ content: string; onClose: () => void }> = ({
  content,
  onClose,
}) => (
  <div className="help-popup-overlay" onClick={onClose}>
    <div className="help-popup-content" onClick={(e) => e.stopPropagation()}>
      <button className="help-popup-close-button" onClick={onClose}>
        ×
      </button>
      <h3 style={{ marginTop: "0" }}>Translation & Explanation</h3>
      <p
        style={{ whiteSpace: "pre-wrap", maxHeight: "60vh", overflowY: "auto" }}
      >
        {content}
      </p>
    </div>
  </div>
);

const LandscapeNotifier: React.FC = () => (
  <div className="landscape-notifier">
    <span className="material-symbols-outlined">screen_rotation</span>
    <span>Please rotate your device for the best experience</span>
  </div>
);

// NEW: Footer component
const Footer: React.FC<{ onHelpClick: () => void }> = ({ onHelpClick }) => (
  <footer className="app-footer">
    {/* This new div will help us with mobile layout */}
    <div className="footer-credits">
      <span className="footer-powered-by">
        © <span style={{ color: "white" }}>Langcampus</span> powered by
      </span>
      {/* This inner div groups the logos */}
      <div className="footer-logos">
        <a
          href="https://gemini.google.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
        >
          <img src="/gemini_logo.png" alt="Gemini" className="footer-logo" />{" "}
          Gemini
        </a>
        <span> and </span>
        <a
          href="https://www.youtube.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
        >
          <img src="/youtube_logo.png" alt="YouTube" className="footer-logo" />{" "}
          YouTube
        </a>
      </div>
    </div>
    <button className="help-button" onClick={onHelpClick}>
      ?
    </button>
  </footer>
);

const PopularSongs: React.FC<{
  songs: YouTubeVideo[];
  isLoading: boolean;
  onSelectSong: (video: YouTubeVideo) => void;
}> = ({ songs, isLoading, onSelectSong }) => {
  if (isLoading) {
    return <div className="loader"></div>;
  }

  if (songs.length === 0) {
    return null; // Don't render anything if there are no songs
  }

  return (
    <div className="popular-songs-container">
      <h3 className="popular-songs-title">Popular Songs</h3>
      <div className="popular-songs-grid">
        {songs.map((song) => (
          <div
            key={song.id.videoId}
            className="video-card popular-song-card"
            onClick={() => onSelectSong(song)}
          >
            <img
              src={song.snippet.thumbnails.high.url}
              alt={song.snippet.title}
            />
            <p className="video-card-title">{song.snippet.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const LandingComponent: React.FC<{
  popularSongs: YouTubeVideo[];
  popularSongsLoading: boolean;
  handleSelectVideo: (video: YouTubeVideo) => void;
}> = ({ popularSongs, popularSongsLoading, handleSelectVideo }) => (
  <>
    <div className="landing-container">
      {/* ... (keep your existing landing-image and landing-content divs here) ... */}
      <img
        src="/landing-image.png"
        alt="Learn languages with music quizzes"
        className="landing-image"
      />
      <div className="landing-content">
        <h2 className="landing-title">Learn Languages Through Music</h2>
        <p className="landing-text">
          Search for any song, take a fill-in-the-blank + multiple choice lyrics
          quiz, and master new vocabulary while you listen.
        </p>
      </div>
    </div>
    <PopularSongs
      songs={popularSongs}
      isLoading={popularSongsLoading}
      onSelectSong={handleSelectVideo}
    />
  </>
);

const App: React.FC = () => {
  // --- STATE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isPausedForQuiz, setIsPausedForQuiz] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<
    "SEARCH" | "RESULTS" | "QUIZ" | "END" | "POST_QUIZ_PLAYBACK"
  >("SEARCH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ttsError, setTtsError] = useState("");
  const [isPlayerReady, setPlayerReady] = useState(false);
  const getInitialLanguage = (): string => {
    const urlParams = new URLSearchParams(window.location.search);
    const langFromUrl = urlParams.get("lang");
    const supportedLanguages = Object.keys(languageCodeMap);

    // If a valid language is in the URL, use it and save it.
    if (langFromUrl && supportedLanguages.includes(langFromUrl)) {
      localStorage.setItem("selectedLanguage", langFromUrl);
      return langFromUrl;
    }

    // Otherwise, fall back to local storage or the default.
    const savedLanguage = localStorage.getItem("selectedLanguage");
    return savedLanguage || "English";
  };
  const [language, setLanguage] = useState(getInitialLanguage);
  const supportedLanguages = Object.keys(languageCodeMap);
  const [showPlayerControls, setShowPlayerControls] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [showHelpPopup, setShowHelpPopup] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [predictiveSuggestions, setPredictiveSuggestions] = useState<string[]>(
    [],
  );
  const [isHistoryDropdown, setIsHistoryDropdown] = useState(true);
  const [audioCache, setAudioCache] = useState<
    Record<string, HTMLAudioElement>
  >({});
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [summary, setSummary] = useState("");
  const [isSummaryLoading, setSummaryLoading] = useState(false);
  const [popularSongs, setPopularSongs] = useState<YouTubeVideo[]>([]);
  const [popularSongsLoading, setPopularSongsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [nativeLanguage, setNativeLanguage] = useState<string | null>(
    localStorage.getItem("nativeLanguage"),
  );
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [isTranslationPopupOpen, setIsTranslationPopupOpen] = useState(false);
  const [translationPopupContent, setTranslationPopupContent] = useState("");
  const [isAuthDropdownOpen, setAuthDropdownOpen] = useState(false);
  const authContainerRef = useRef<HTMLDivElement>(null);

  // --- REFS ---
  const playerRef = useRef<YouTubePlayer | null>(null);
  const timeCheckIntervalRef = useRef<number | null>(null);
  const lastPlaybackTimeRef = useRef<number>(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const fetchSuggestionsAbortControllerRef = useRef<AbortController | null>(
    null,
  );

  // --- LIFECYCLE ---
  useEffect(() => {
    localStorage.setItem("selectedLanguage", language);
  }, [language]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const videoIdFromUrl = urlParams.get("video_id");

    if (videoIdFromUrl) {
      // Create a temporary video object to pass to the selection handler
      const videoFromUrl: YouTubeVideo = {
        id: { videoId: videoIdFromUrl },
        snippet: {
          // We don't have the real snippet yet, so we use placeholders
          title: "Loading video...",
          thumbnails: {
            high: { url: "" },
          },
        },
      };
      // Immediately try to select and validate this video
      handleSelectVideo(videoFromUrl);
    }
  }, []);

  useEffect(() => {
    // This effect keeps the URL in sync with the app's state
    const urlParams = new URLSearchParams();
    urlParams.set("lang", language); // Always include the current language

    if (selectedVideo) {
      urlParams.set("video_id", selectedVideo.id.videoId);
    }

    const newSearch = urlParams.toString();
    // Only add the '?' if there are parameters to add
    const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`;

    // Update the URL without reloading the page
    window.history.pushState({ path: newUrl }, "", newUrl);
  }, [language, selectedVideo]); // Re-run whenever the language or video changes

  useEffect(() => {
    const fetchPopularSongs = async () => {
      if (!language) return;
      setPopularSongsLoading(true);
      try {
        // Call your new, caching Cloud Function
        const response = await fetch(`/getPopularVideos?language=${language}`);
        if (!response.ok) {
          throw new Error("Failed to fetch popular songs from the server");
        }
        const data = await response.json();
        if (data.items) {
          setPopularSongs(data.items);
        }
      } catch (error) {
        console.error("Could not fetch popular songs:", error);
        setPopularSongs([]);
      } finally {
        setPopularSongsLoading(false);
      }
    };

    fetchPopularSongs();
  }, [language]);

  useEffect(() => {
    const styleTag = document.createElement("style");
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
      console.log(
        `[Predictive Search Log]: Search term changed to "${searchTerm}". Debouncing API call.`,
      );
      setIsHistoryDropdown(false);

      const controller = new AbortController();
      fetchSuggestionsAbortControllerRef.current = controller;

      const timeoutId = setTimeout(async () => {
        try {
          // THIS IS THE CORRECTED LINE: Only send the 'q' parameter.
          const url = `/suggestV3?q=${encodeURIComponent(searchTerm)}`; // <-- Change to suggestV3
          console.log(`[Predictive Search Log]: Making API call to ${url}`);

          const response = await fetch(url, { signal: controller.signal });

          if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
          }

          const jsonData = await response.json();
          console.log(
            "[Predictive Search Log]: API response received:",
            jsonData,
          );

          // This is the function you updated earlier. It is correct.
          const suggestions = parseYouTubeSuggestions(jsonData);
          console.log(
            "[Predictive Search Log]: Parsed suggestions:",
            suggestions,
          );
          setPredictiveSuggestions(suggestions);
        } catch (e: any) {
          if (e.name !== "AbortError") {
            console.error(
              "[Predictive Search Log]: Failed to fetch or parse suggestions:",
              e,
            );
          }
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      console.log(
        `[Predictive Search Log]: Search term is too short or empty. Reverting to history dropdown.`,
      );
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

  useEffect(() => {
    if (ttsError) {
      const timer = setTimeout(() => {
        setTtsError("");
      }, 5000); // 5000 milliseconds = 5 seconds
      return () => clearTimeout(timer);
    }
  }, [ttsError]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // User is logged in, load their specific language preference
        const savedLanguage = localStorage.getItem(
          `nativeLanguage_${currentUser.uid}`,
        );
        if (savedLanguage) {
          setNativeLanguage(savedLanguage);
        }
      } else {
        // User is logged out, clear the language preference from the state
        setNativeLanguage(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      // Trigger the popup. onAuthStateChanged will handle the result.
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google popup", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAuthDropdownOpen(false); // Close dropdown on logout
  };

  const handleNativeLanguageSelect = (lang: string) => {
    if (user) {
      localStorage.setItem(`nativeLanguage_${user.uid}`, lang);
      setNativeLanguage(lang);
      setAuthDropdownOpen(false); // Also close the dropdown on selection
    }
  };

  useEffect(() => {
    // This effect runs whenever the user state changes.
    if (user) {
      // User is logged in, load their specific language preference.
      const savedLanguage = localStorage.getItem(`nativeLanguage_${user.uid}`);
      if (savedLanguage) {
        setNativeLanguage(savedLanguage);
      }
    } else {
      // User is logged out, clear the language preference from the state.
      setNativeLanguage(null);
    }
  }, [user]); // The dependency array ensures this runs when 'user' changes.

  const handleTranslate = async (text: string) => {
    if (!nativeLanguage || nativeLanguage === language) return;

    setTranslationPopupContent("Translating..."); // Show loading message
    setIsTranslationPopupOpen(true);

    try {
      const response = await fetch(
        `/translateText?text=${encodeURIComponent(text)}&targetLang=${nativeLanguage}&sourceLang=${language}`,
      );
      if (!response.ok) {
        throw new Error("Failed to translate text from server");
      }
      const data = await response.json();
      setTranslationPopupContent(data.translatedText); // Set the final content
    } catch (error) {
      console.error("Translation error:", error);
      setTranslationPopupContent(
        "Sorry, an error occurred during translation.",
      );
    }
  };

  // Helper functions are now inside the component
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

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

    const wavBlob = new Blob([wavHeader, pcmData], { type: "audio/wav" });
    return wavBlob;
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
      const response = await fetch(
        `/generateTts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch audio from the server");
      }
      const data = await response.json();
      const audioContent = data.audioContent;

      const audioBuffer = base64ToArrayBuffer(audioContent);
      const audioBlob = pcmToWav(audioBuffer);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setIsAudioPlaying(false);
      };

      audio.play();
      setIsAudioPlaying(true);

      setAudioCache((prevCache) => ({
        ...prevCache,
        [audioKey]: audio,
      }));
    } catch (e) {
      console.error("Failed to generate or play audio:", e);
      setTtsError("Sorry, try again...");
    } finally {
      if (!isAudioPlaying) {
        setIsAudioPlaying(false);
      }
    }
  };

  // --- API & LOGIC ---
  const onPlayerReady = (event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
    setPlayerReady(true);
  };

  const addSearchToHistory = (term: string) => {
    const trimmedTerm = term.trim();
    if (trimmedTerm && !searchHistory.includes(trimmedTerm)) {
      setSearchHistory((prevHistory) => {
        const newHistory = [
          trimmedTerm,
          ...prevHistory.filter((t) => t !== trimmedTerm),
        ];
        return newHistory.slice(0, 10);
      });
    }
  };

  const handleSearch = useCallback(async (term: string) => {
    if (!term) return;
    setLoading(true);
    setError("");
    setSearchResults([]);
    setShowDropdown(false);

    addSearchToHistory(term);
    setSearchTerm(term);

    try {
      const response = await fetch(
        `/searchVideos?q=${encodeURIComponent(term)}`,
      );
      if (!response.ok) throw new Error("Server error during search.");

      const data = await response.json();
      if (data.items && data.items.length > 0) {
        setSearchResults(data.items);
        setGameState("RESULTS");
      } else {
        setError("No music videos found for your search.");
        setGameState("SEARCH");
      }
    } catch (err: any) {
      setError(err.message || "An unknown error occurred during search.");
      setGameState("SEARCH");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectVideo = async (video: YouTubeVideo) => {
    setLoading(true);
    setError("");
    try {
      setSearchResults([video]);

      const response = await fetch(
        `/getVideoDetails?videoId=${video.id.videoId}`,
      );
      if (!response.ok) {
        throw new Error("Could not verify video length.");
      }
      const data = await response.json();
      const durationString = data.items?.[0]?.contentDetails?.duration;

      if (!durationString) {
        throw new Error("Could not retrieve video duration.");
      }

      const durationInSeconds = parseISO8601Duration(durationString);
      const FIFTEEN_MINUTES = 900;

      if (durationInSeconds > FIFTEEN_MINUTES) {
        setError("Please select a video that is 15 minutes or shorter.");
        setLoading(false);
        setGameState("SEARCH");
        return;
      }

      setPlayerReady(false);
      setSelectedVideo(video);
      setGameState("QUIZ");
    } catch (err: any) {
      setError(err.message || "An error occurred selecting the video.");
      setGameState("SEARCH");
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!selectedVideo || !isPlayerReady) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/generateQuiz?videoId=${selectedVideo.id.videoId}&language=${language}`,
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText || "Failed to generate quiz from the server.",
        );
      }

      const quizData: { questions: QuizQuestion[] } = await response.json();

      if (quizData.questions && quizData.questions.length > 0) {
        const processedQuiz = quizData.questions
          .map((q) => ({
            ...q,
            options: shuffleArray(q.options),
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        setQuiz(processedQuiz);
        setIsQuizActive(true);
        playerRef.current?.playVideo();
      } else {
        throw new Error("Could not generate a valid quiz from the video.");
      }
    } catch (err: any) {
      setError(err.message);
      setIsQuizActive(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchSummary = async () => {
    if (!selectedVideo) return;
    setSummaryLoading(true);
    try {
      const response = await fetch(
        `/getSummary?videoId=${selectedVideo.id.videoId}&language=${language}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch summary from the server");
      }
      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      console.error("Failed to fetch summary", err);
      setSummary("Could not generate a summary for this video.");
    } finally {
      setSummaryLoading(false);
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

    if (option === quiz[currentQuestionIndex].correctAnswer) {
      setScore((s) => s + 1);
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
        setGameState("END");
        setShowEndScreen(true);
        handleFetchSummary();
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

  const handleVideoEnd = (event: { target: YouTubePlayer; data: number }) => {
    // Check if the video has ended (data === 0) and the quiz is still in progress
    if (event.data === 0 && isQuizActive) {
      setIsQuizActive(false);
      setGameState("END");
      setShowEndScreen(true);
      handleFetchSummary();
    }
  };

  const handleReset = () => {
    setSearchTerm("");
    setSearchResults([]);
    setSelectedVideo(null);
    setQuiz([]);
    setCurrentQuestionIndex(0);
    setIsQuizActive(false);
    setIsPausedForQuiz(false);
    setAnswered(false);
    setScore(0);
    setGameState("SEARCH");
    setError("");
    setSummary("");
    setSummaryLoading(false);
    lastPlaybackTimeRef.current = 0;
    window.history.pushState({}, "", "/");
  };

  const handleClearHistory = () => {
    setSearchHistory([]);
    setShowDropdown(false);
  };

  const handleDropdownItemClick = (term: string) => {
    handleSearch(term);
    setSearchTerm(term);
  };

  return (
    <div className="app-container">
      <div className="auth-container" ref={authContainerRef}>
        {!user ? (
          <button className="login-button" onClick={handleLogin}>
            <svg viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,5 12,5C14.5,5 16.22,6.17 17.06,6.95L19.25,4.76C17.38,3.16 14.88,2 12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,11.64 21.95,11.31 21.86,11H21.35Z"
              ></path>
            </svg>
            <span>Sign in</span>
          </button>
        ) : (
          <div>
            <button
              className="user-profile-button"
              onClick={() => setAuthDropdownOpen(!isAuthDropdownOpen)}
            >
              <img
                src={user.photoURL!}
                alt={user.displayName!}
                title={user.displayName!}
              />
            </button>
            {isAuthDropdownOpen && (
              <div className="auth-dropdown">
                <label htmlFor="native-lang-select">
                  Select Native Language
                </label>
                <select
                  id="native-lang-select"
                  className="native-lang-select"
                  onChange={(e) => handleNativeLanguageSelect(e.target.value)}
                  value={nativeLanguage || ""}
                >
                  <option value="" disabled>
                    Choose a language
                  </option>
                  {supportedLanguages.map((lang) => (
                    <option key={lang} value={lang}>
                      {languageToFlagMap[lang]} {lang}
                    </option>
                  ))}
                </select>
                <button className="logout-button" onClick={handleLogout}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showHelpPopup && <HelpPopup onClose={() => setShowHelpPopup(false)} />}
      {isTranslationPopupOpen && (
        <TranslationPopup
          content={translationPopupContent}
          onClose={() => setIsTranslationPopupOpen(false)}
        />
      )}
      <header onClick={handleReset} style={{ cursor: "pointer" }}>
        <h1 style={{ letterSpacing: "-0.09925em" }}>
          <img
            className="app-logo"
            src="/logo.png"
            style={{
              height: "45px",
              width: "45px",
              background: "rgba(256, 256, 256, 1)",
              borderRadius: "50%",
              padding: "3px",
              border: "2px solid #ff0000",
              verticalAlign: "middle",
            }}
          />
          Langcampus
        </h1>
      </header>

      <div className="language-selector-container">
        <label htmlFor="language-select">Quiz Language: </label>
        <select
          id="language-select"
          className="language-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={
            gameState === "QUIZ" ||
            gameState === "END" ||
            gameState === "POST_QUIZ_PLAYBACK"
          }
        >
          {supportedLanguages.map((lang) => (
            <option key={lang} value={lang}>
              {languageToFlagMap[lang]} {lang}
            </option>
          ))}
        </select>
      </div>

      {(gameState === "SEARCH" || gameState === "RESULTS") && (
        <div className="search-container" ref={searchContainerRef}>
          <input
            type="text"
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search songs..."
            onKeyDown={(e) => e.key === "Enter" && handleSearch(searchTerm)}
            aria-label="Search for a song"
            onFocus={() => setShowDropdown(true)}
            onBlur={(e) => {
              setTimeout(() => {
                if (
                  !searchContainerRef.current?.contains(document.activeElement)
                ) {
                  setShowDropdown(false);
                }
              }, 100);
            }}
          />
          <button
            className="search-button"
            onClick={() => handleSearch(searchTerm)}
            disabled={loading}
            aria-label="Search"
          >
            {loading ? (
              "..."
            ) : (
              <>
                <span className="search-button-text">Search</span>
                <span className="search-button-icon">🔍</span>
              </>
            )}
          </button>
          {showDropdown &&
            (predictiveSuggestions.length > 0 || searchHistory.length > 0) && (
              <ul className="search-dropdown">
                {isHistoryDropdown ? (
                  <>
                    <h4 style={{ color: "var(--text-secondary)" }}>
                      Recent Searches
                    </h4>
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
                    <li
                      className="search-dropdown-clear"
                      onClick={handleClearHistory}
                    >
                      Clear History
                    </li>
                  </>
                ) : (
                  <>
                    <h4 style={{ color: "var(--text-secondary)" }}>
                      Suggestions
                    </h4>
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
        {(() => {
          if (loading && (gameState === "SEARCH" || gameState === "RESULTS")) {
            return <div className="loader"></div>;
          }

          if (error && gameState !== "QUIZ" && gameState !== "END") {
            return (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1rem",
                  marginTop: "1rem",
                }}
              >
                <p className="error-message" style={{ marginBottom: 0 }}>
                  {error}
                </p>
                <button className="action-button" onClick={handleReset}>
                  Try Again
                </button>
              </div>
            );
          }

          switch (gameState) {
            case "RESULTS":
              return (
                <div className="results-grid">
                  {searchResults.map((video) => (
                    <div
                      key={video.id.videoId}
                      className="video-card"
                      onClick={() => handleSelectVideo(video)}
                    >
                      <img
                        src={video.snippet.thumbnails.high.url}
                        alt={video.snippet.title}
                      />
                      <p className="video-card-title">{video.snippet.title}</p>
                    </div>
                  ))}
                </div>
              );

            case "QUIZ":
            case "END":
            case "POST_QUIZ_PLAYBACK":
              const playerOptions = {
                height: "100%",
                width: "100%",
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
                <>
                  <div className="quiz-area">
                    {selectedVideo && (
                      <YouTube
                        videoId={selectedVideo.id.videoId}
                        opts={playerOptions}
                        onReady={onPlayerReady}
                        onStateChange={handleVideoEnd}
                        className="youtube-container"
                      />
                    )}
                    {loading && gameState === "QUIZ" && (
                      <div className="quiz-overlay visible">
                        <div className="loader"></div>
                        <p>Generating your quiz...</p>
                      </div>
                    )}
                    {!isQuizActive &&
                      gameState === "QUIZ" &&
                      !loading &&
                      !error && (
                        <div className="quiz-controls">
                          <button
                            className="action-button"
                            onClick={handleStartQuiz}
                            disabled={!isPlayerReady || loading}
                          >
                            {isPlayerReady ? "Start Quiz" : "Player Loading..."}
                          </button>
                        </div>
                      )}
                    {error && (
                      <div className="quiz-overlay visible">
                        <p className="error-message">{error}</p>
                        <button className="action-button" onClick={handleReset}>
                          Try Another Song
                        </button>
                      </div>
                    )}
                    {isPausedForQuiz && currentQuestion && (
                      <div className={`quiz-overlay visible`}>
                        {ttsError && (
                          <p className="error-message">{ttsError}</p>
                        )}
                        <p>
                          Question {currentQuestionIndex + 1} of {quiz.length}
                        </p>
                        <p className="preceding-lyric">
                          {currentQuestion.precedingLyric}
                        </p>
                        <h2 className="question-text">
                          {currentQuestion.question}
                          <button
                            className="tts-button"
                            onClick={() =>
                              playAudio(currentQuestion.question, language)
                            }
                            disabled={isAudioPlaying}
                          >
                            🔊
                          </button>
                        </h2>
                        <div className="options-grid">
                          {currentQuestion.options.map((option, index) => {
                            let buttonClass = "option-button";
                            if (answered)
                              buttonClass +=
                                option === currentQuestion.correctAnswer
                                  ? " correct"
                                  : " incorrect";
                            return (
                              <button key={index} className={buttonClass} onClick={() => handleAnswer(option)} disabled={answered}>
                                  {option}
                                  {user && nativeLanguage && nativeLanguage !== language && (
                                      <button className="translate-button" onClick={(e) => {
                                          e.stopPropagation();
                                          handleTranslate(option);
                                      }}>
                                          🌐
                                      </button>
                                  )}
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
                    {gameState === "END" && showEndScreen && (
                      <div className="quiz-overlay visible">
                        <div className="final-score">
                          <h2>Quiz Complete!</h2>
                          <p style={{ fontSize: "1.5rem" }}>
                            Your final score is: {score} / {quiz.length}
                          </p>
                          {isSummaryLoading ? (
                            <p>Generating summary...</p>
                          ) : (
                            summary && (
                              <p
                                style={{
                                  textAlign: "left",
                                  marginTop: "2rem",
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {summary}
                              </p>
                            )
                          )}
                          <div className="button-container">
                            <button
                              className="action-button"
                              onClick={handleReset}
                            >
                              Play Another Song
                            </button>
                            <button
                              className="action-button finish-listening-button"
                              onClick={handleFinishListening}
                            >
                              Finish Listening
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <LandscapeNotifier />
                </>
              );

            case "SEARCH":
            default:
              return (
                <LandingComponent
                  popularSongs={popularSongs}
                  popularSongsLoading={popularSongsLoading}
                  handleSelectVideo={handleSelectVideo}
                />
              );
          }
        })()}
      </main>
      <Footer onHelpClick={() => setShowHelpPopup(true)} />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
