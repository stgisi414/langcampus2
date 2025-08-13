import { onRequest } from "firebase-functions/v2/https";
import { config } from "firebase-functions";
import * as logger from "firebase-functions/logger";
import axios from "axios";
import * as admin from "firebase-admin";

// AI and YouTube API interaction
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Securely get API keys from the environment
const YOUTUBE_API_KEY = config().youtube.key;
const SUPADATA_API_KEY = config().supadata.key;
const GEMINI_API_KEY = YOUTUBE_API_KEY;

// Your existing suggestV3 function (no changes needed here)
export const suggestV3 = onRequest({ cors: true }, async (request, response) => {
    logger.info("Suggest function triggered", { query: request.query });
    try {
        const officialApiUrl = "https://www.googleapis.com/youtube/v3/search";
        const apiResponse = await axios.get(officialApiUrl, {
            params: {
                ...request.query,
                part: 'snippet',
                type: 'video',
                maxResults: 10,
            },
        });
        response.status(200).send(apiResponse.data);
    } catch (error) {
        logger.error("CRITICAL ERROR in suggest function:", error);
        response.status(500).send("The server function encountered a critical error.");
    }
});


// --- NEW CACHING FUNCTION ---
export const getPopularVideos = onRequest({ cors: true }, async (request, response) => {
    const { language } = request.query;

    const YOUTUBE_API_KEY = config().youtube.key;

    if (typeof language !== 'string' || typeof key !== 'string') {
        response.status(400).send("Missing 'language' or 'key' query parameter.");
        return;
    }

    const cacheDocRef = db.collection('popularVideosCache').doc(language);
    const CACHE_DURATION_HOURS = 4;

    try {
        const doc = await cacheDocRef.get();
        if (doc.exists) {
            const data = doc.data();
            
            // --- FIX IS HERE ---
            // Add a check to ensure data is not undefined before using it
            if (data && data.timestamp) { 
                const now = new Date();
                const lastFetched = data.timestamp.toDate();
                const hoursDiff = (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60);

                if (hoursDiff < CACHE_DURATION_HOURS) {
                    logger.info(`Serving cached data for language: ${language}`);
                    response.status(200).send(data.videos);
                    return;
                }
            }
        }

        // If cache is stale or doesn't exist, fetch from YouTube API
        logger.info(`Fetching fresh data for language: ${language}`);
        const officialApiUrl = "https://www.googleapis.com/youtube/v3/search";
        const apiResponse = await axios.get(officialApiUrl, {
            params: {
                part: 'snippet',
                q: `Top music videos ${language}`,
                type: 'video',
                chart: 'mostPopular',
                videoCategoryId: '10',
                maxResults: 6,
                key: YOUTUBE_API_KEY,
            },
        });
        
        const videos = apiResponse.data;

        // Save the new data to the cache in Firestore
        await cacheDocRef.set({
            videos: videos,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        response.status(200).send(videos);

    } catch (error) {
        if (error.response) {
            logger.error("Axios error response:", error.response.data);
        }
        logger.error(`CRITICAL ERROR in getPopularVideos for language ${language}:`, error);
        response.status(500).send("The server function encountered a critical error fetching popular videos.");
    }
});

// --- NEW FUNCTION: searchVideos ---
export const searchVideos = onRequest({ cors: true }, async (request, response) => {
    const { q } = request.query;
    if (typeof q !== 'string') {
        response.status(400).send("Missing 'q' query parameter.");
        return;
    }
    try {
        const officialApiUrl = "https://www.googleapis.com/youtube/v3/search";
        const apiResponse = await axios.get(officialApiUrl, {
            params: {
                part: 'snippet',
                q: `${q} official music video`,
                type: 'video',
                maxResults: 6,
                key: YOUTUBE_API_KEY,
            },
        });
        response.status(200).send(apiResponse.data);
    } catch (error: any) {
        logger.error(`Error in searchVideos for query "${q}":`, error);
        response.status(500).send("Server error during video search.");
    }
});


const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- NEW FUNCTION: generateQuiz ---
export const generateQuiz = onRequest({ cors: true }, async (request, response) => {
    const { videoId, language } = request.query;

    if (typeof videoId !== 'string' || typeof language !== 'string') {
        response.status(400).send("Missing 'videoId' or 'language' parameter.");
        return;
    }

    try {
        // Step 1: Fetch Transcript and Video Details
        const [transcriptResponse, videoDetailsResponse] = await Promise.all([
            axios.get(`https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}`, {
                headers: { 'x-api-key': SUPADATA_API_KEY }
            }),
            axios.get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`)
        ]);

        const fullTranscript = transcriptResponse.data.content?.map((s: any) => s.text).join(' ') || '';
        const videoDetails = videoDetailsResponse.data.items?.[0] || {};
        const videoSnippet = videoDetails.snippet || {};
        const videoContentDetails = videoDetails.contentDetails || {};
        const videoDescription = videoSnippet.description || 'No description available.';
        const videoTags = videoSnippet.tags?.join(', ') || 'No tags available.';
        const videoDuration = videoContentDetails.duration || 'PT0M0S';

        // Step 2: Prepare Prompt and Schema for Gemini
        const parseISODuration = (duration: string): number => {
            const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
            const matches = duration.match(regex);
            if (!matches) return 0;
            const hours = parseInt(matches[1] || '0');
            const minutes = parseInt(matches[2] || '0');
            const seconds = parseInt(matches[3] || '0');
            return (hours * 3600) + (minutes * 60) + seconds;
        };

        const videoDurationInSeconds = parseISODuration(videoDuration);
        const finalQuestionTimestampLimit = Math.max(0, videoDurationInSeconds - 20);

        const schema = {
            type: "OBJECT", // Use string literals for enums
            properties: {
                questions: {
                    type: "ARRAY",
                    description: "An array of quiz questions...",
                    items: {
                        type: "OBJECT",
                        properties: {
                            timestamp: { type: "INTEGER", description: "Time in seconds...", maximum: finalQuestionTimestampLimit },
                            precedingLyric: { type: "STRING", description: "The lyric line before the question." },
                            question: { type: "STRING", description: "The lyric with a blank..." },
                            options: { type: "ARRAY", items: { type: "STRING" }, description: "4 multiple-choice options." },
                            correctAnswer: { type: "STRING", description: "The correct answer." },
                        },
                        required: ["timestamp", "precedingLyric", "question", "options", "correctAnswer"],
                    },
                },
            },
            required: ["questions"],
        };

        const textPart: Part = {
            text: `Please create a fill-in-the-blank lyrics quiz for the provided music video.
            
            Here is additional context for the video:
            - Video Title: "${videoSnippet.title}"
            - Video Description: "${videoDescription}"
            - Video Tags: "${videoTags}"
            - Full Song Transcript: "${fullTranscript}"
            - Video Duration: ${videoDuration}

            IMPORTANT INSTRUCTIONS:
            1.  Base the quiz questions *directly* on the provided transcript.
            2.  Generate as many high-quality questions as possible and distribute them evenly throughout the song.
            3.  Provide an accurate timestamp (in seconds) from the video for when each question should appear.
            4.  The user's chosen language is ${language}. Generate the entire quiz (preceding lyric, question, and all options) in ${language}.
            5.  Ensure all four options for each question are unique and one is clearly the correct answer from the lyrics.
            6.  FIX: EXTREMELY IMPORTANT: Only use lyrics that are in the user's chosen language of ${language}.
            7.  CRITICAL TIMING CONSTRAINT: The timestamp for the final question absolutely MUST be at least 20 seconds less than the total video duration (${videoDuration}). Do not place any questions within the last 20 seconds of the video.`
        };

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const videoPart: Part = {
            fileData: { mimeType: "video/youtube", fileUri: videoUrl }
        };

        // Step 3: Call Gemini
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: 'application/json' },
            tools: [{ functionDeclarations: [{ name: 'output_quiz', description: 'The quiz questions', parameters: schema }] }]
        });

        const result = await model.generateContent({
            contents: [{ parts: [videoPart, textPart] }]
        });
        
        const quizData = result.response.candidates[0].content.parts[0].functionCall.args;
        response.status(200).send(quizData);

    } catch (error: any) {
        logger.error(`Error generating quiz for videoId "${videoId}":`, error);
        if (error.response) logger.error("Axios Sub-Error:", error.response.data);
        response.status(500).send("Failed to generate quiz.");
    }
});