import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import axios from "axios";
import * as admin from "firebase-admin";

import { GoogleGenerativeAI, Part, HarmCategory, HarmBlockThreshold, SchemaType, FunctionDeclarationSchema } from "@google/generative-ai";

// Initialize Firebase Admin (this is safe to keep global)
admin.initializeApp();
const db = admin.firestore();

// Define the secrets your functions will need
const secrets = ["YOUTUBE_KEY", "SUPADATA_KEY"];

// --- suggestV3 FUNCTION ---
export const suggestV3 = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    // FIX: Use process.env to access secrets
    const YOUTUBE_API_KEY = process.env.YOUTUBE_KEY;
    logger.info("Suggest function triggered", { query: request.query });
    try {
        const officialApiUrl = "https://www.googleapis.com/youtube/v3/search";
        const apiResponse = await axios.get(officialApiUrl, {
            params: {
                ...request.query,
                part: 'snippet',
                type: 'video',
                maxResults: 10,
                key: YOUTUBE_API_KEY,
            },
        });
        response.status(200).send(apiResponse.data);
    } catch (error: any) {
        logger.error("CRITICAL ERROR in suggest function:", error);
        response.status(500).send("The server function encountered a critical error.");
    }
});


// --- getPopularVideos CACHING FUNCTION ---
export const getPopularVideos = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    // FIX: Use process.env to access secrets
    const YOUTUBE_API_KEY = process.env.YOUTUBE_KEY;
    const { language } = request.query;

    if (typeof language !== 'string') {
        response.status(400).send("Missing 'language' query parameter.");
        return;
    }

    // NEW: Map of languages to their word for "lyrics"
    const lyricsTranslationMap: Record<string, string> = {
        'English': 'lyrics',
        'Spanish': 'letra',
        'French': 'paroles',
        'German': 'songtext',
        'Japanese': '歌詞',
        'Korean': '가사',
        'Italian': 'testo',
        'Portuguese': 'letra',
        'Russian': 'текст песни',
        'Arabic': 'كلمات',
        'Chinese': '歌词',
        'Hindi': 'गीत',
        'Turkish': 'şarkı sözleri',
        'Polish': 'tekst piosenki',
        'Dutch': 'songtekst',
        'Swedish': 'låttext',
        'Finnish': 'sanat'
    };

    const lyricWord = lyricsTranslationMap[language] || 'lyrics';

    const cacheDocRef = db.collection('popularVideosCache').doc(language);
    const CACHE_DURATION_HOURS = 4;

    try {
        const doc = await cacheDocRef.get();
        if (doc.exists) {
            const data = doc.data();
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

        logger.info(`Fetching fresh data for language: ${language}`);
        const officialApiUrl = "https://www.googleapis.com/youtube/v3/search";
        const apiResponse = await axios.get(officialApiUrl, {
            params: {
                part: 'snippet',
                // Use the translated word for "lyrics" in the query
                q: `Top music videos ${language} ${lyricWord}`,
                type: 'video',
                chart: 'mostPopular',
                videoCategoryId: '10',
                maxResults: 6,
                key: YOUTUBE_API_KEY,
            },
        });
        
        const videos = apiResponse.data;
        await cacheDocRef.set({
            videos: videos,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        response.status(200).send(videos);

    } catch (error: any) {
        if (error.response) {
            logger.error("Axios error response:", error.response.data);
        }
        logger.error(`CRITICAL ERROR in getPopularVideos for language ${language}:`, error);
        response.status(500).send("The server function encountered a critical error fetching popular videos.");
    }
});

// --- searchVideos FUNCTION ---
export const searchVideos = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    // FIX: Use process.env to access secrets
    const YOUTUBE_API_KEY = process.env.YOUTUBE_KEY;
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

// --- generateQuiz FUNCTION ---
export const generateQuiz = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    // FIX: Use process.env to access secrets
    const YOUTUBE_API_KEY = process.env.YOUTUBE_KEY;
    const SUPADATA_API_KEY = process.env.SUPADATA_KEY;
    
    // Ensure the keys are not undefined
    if (!YOUTUBE_API_KEY || !SUPADATA_API_KEY) {
        logger.error("API keys are not set in the environment.");
        response.status(500).send("Server configuration error.");
        return;
    }

    const genAI = new GoogleGenerativeAI(YOUTUBE_API_KEY);

    const { videoId, language } = request.query;
    if (typeof videoId !== 'string' || typeof language !== 'string') {
        response.status(400).send("Missing 'videoId' or 'language' parameter.");
        return;
    }

    try {
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
        
        const schema: FunctionDeclarationSchema = {
            type: SchemaType.OBJECT,
            properties: {
                questions: {
                    type: SchemaType.ARRAY,
                    description: "An array of quiz questions based on the song's lyrics, including timestamps.",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            timestamp: { type: SchemaType.INTEGER, description: "Time in seconds to pause the video." },
                            precedingLyric: { type: SchemaType.STRING, description: "The lyric line immediately before the question." },
                            question: { type: SchemaType.STRING, description: "The lyric with a blank to be filled (e.g., '...to the old town ____')." },
                            options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "An array of 4 multiple-choice options." },
                            correctAnswer: { type: SchemaType.STRING, description: "The correct answer from the options." },
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

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
            tools: [{
                functionDeclarations: [{
                    name: "output_quiz",
                    description: "Formats the quiz questions and answers.",
                    parameters: schema,
                }]
            }]
        });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [videoPart, textPart] }]
        });
        
        const call = result.response?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
        if (!call || !call.args) {
            throw new Error("Failed to get a valid function call response from the AI.");
        }
        
        response.status(200).send(call.args);

    } catch (error: any) {
        logger.error(`Error generating quiz for videoId "${videoId}":`, error);
        if (error.response) logger.error("Axios Sub-Error:", error.response.data);
        response.status(500).send("Failed to generate quiz.");
    }
});