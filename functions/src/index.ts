import { onRequest } from "firebase-functions/v2/https"; // This is the corrected line
import * as logger from "firebase-functions/logger";
import axios, { AxiosRequestConfig } from "axios";
import * as admin from "firebase-admin";

import { GoogleGenerativeAI, Part, HarmCategory, HarmBlockThreshold, SchemaType, FunctionDeclarationSchema } from "@google/generative-ai";

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Define the secrets your functions will need
const secrets = ["YOUTUBE_KEY", "YOUTUBE_KEY_BACKUP", "SUPADATA_KEY"];

// --- NEW: Reusable YouTube API Requester with Fallback Logic ---
const youtubeApiRequest = async (config: AxiosRequestConfig) => {
    const PRIMARY_KEY = process.env.YOUTUBE_KEY;
    const BACKUP_KEY = process.env.YOUTUBE_KEY_BACKUP;
    const baseUrl = "https://www.googleapis.com/youtube/v3";

    // Try with the primary key first
    try {
        const fullConfig = {
            ...config,
            url: `${baseUrl}${config.url}`,
            params: { ...config.params, key: PRIMARY_KEY }
        };
        logger.info("Attempting YouTube API request with primary key.");
        const response = await axios(fullConfig);
        return response.data;
    } catch (error: any) {
        // Check if the error is a quota exceeded error
        const isQuotaError = error.response?.status === 403 &&
                             error.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded';

        if (isQuotaError && BACKUP_KEY) {
            logger.warn("Primary YouTube API key quota exceeded. Falling back to backup key.");
            // If it's a quota error and a backup key exists, retry with the backup key
            const fallbackConfig = {
                ...config,
                url: `${baseUrl}${config.url}`,
                params: { ...config.params, key: BACKUP_KEY }
            };
            const fallbackResponse = await axios(fallbackConfig);
            return fallbackResponse.data;
        } else {
            // If it's not a quota error or there's no backup key, throw the original error
            logger.error("YouTube API request failed with a non-quota error or no backup key is available.");
            throw error;
        }
    }
};


// --- suggestV3 FUNCTION (Refactored) ---
export const suggestV3 = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    logger.info("Suggest function triggered", { query: request.query });
    try {
        const apiResponseData = await youtubeApiRequest({
            url: "/search",
            params: {
                ...request.query,
                part: 'snippet',
                type: 'video',
                maxResults: 10,
            },
        });
        response.status(200).send(apiResponseData);
    } catch (error: any) {
        logger.error("CRITICAL ERROR in suggest function:", error);
        response.status(500).send("The server function encountered a critical error.");
    }
});


// --- getPopularVideos CACHING FUNCTION (Refactored) ---
export const getPopularVideos = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    const { language } = request.query;
    if (typeof language !== 'string') {
        response.status(400).send("Missing 'language' query parameter.");
        return;
    }

    const searchQueryMap: Record<string, string> = {
        'English': 'official lyric video top hits', 'Spanish': 'letra oficial exitos', 'French': 'paroles officielles top chansons', 'German': 'beliebte deutsche lieder offizielles textvideo', 'Japanese': '公式 歌詞付き 人気曲', 'Korean': '가사 공식 인기 노래', 'Italian': 'testo ufficiale canzoni popolari', 'Portuguese': 'letra oficial musicas populares', 'Russian': 'официальное лирик-видео популярные песни', 'Arabic': 'فيديو كلمات الأغاني الرسمي', 'Chinese': '官方歌詞MV 流行歌曲', 'Hindi': 'लोकप्रिय हिंदी गीत आधिकारिक गीत वीडियो', 'Turkish': 'resmi şarkı sözü videoları popüler', 'Polish': 'oficjalne wideo z tekstem popularne piosenki', 'Dutch': 'officiële songtekst video populaire liedjes', 'Swedish': 'officiell textvideo populära låtar', 'Finnish': 'virallinen sanoitusvideo suosittuja kappaleita'
    };
    const searchQuery = searchQueryMap[language] || `top music videos ${language} lyrics`;
    const cacheDocRef = db.collection('popularVideosCache').doc(language);
    const CACHE_DURATION_HOURS = 4;

    try {
        const doc = await cacheDocRef.get();
        if (doc.exists) {
            const data = doc.data();
            if (data?.timestamp) {
                const hoursDiff = (new Date().getTime() - data.timestamp.toDate().getTime()) / 3600000;
                if (hoursDiff < CACHE_DURATION_HOURS) {
                    logger.info(`Serving cached data for language: ${language}`);
                    response.status(200).send(data.videos);
                    return;
                }
            }
        }

        logger.info(`Fetching fresh lyric videos for language: ${language} with query: "${searchQuery}"`);
        const apiResponseData = await youtubeApiRequest({
            url: "/search",
            params: {
                part: 'snippet', q: searchQuery, type: 'video', videoCategoryId: '10', videoDuration: 'short', videoCaption: 'closedCaption', maxResults: 25,
            },
        });
        
        const filteredVideos = apiResponseData.items
            .filter((item: any) => item.id.kind === 'youtube#video')
            .slice(0, 8);
        
        const responsePayload = { items: filteredVideos };

        await cacheDocRef.set({
            videos: responsePayload,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        response.status(200).send(responsePayload);

    } catch (error: any) {
        if (axios.isAxiosError(error)) logger.error("Axios error response:", error.response?.data);
        logger.error(`CRITICAL ERROR in getPopularVideos for language ${language}:`, error);
        response.status(500).send("The server function encountered a critical error fetching popular videos.");
    }
});

// --- searchVideos FUNCTION (Refactored) ---
export const searchVideos = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    const { q } = request.query;
    if (typeof q !== 'string') {
        response.status(400).send("Missing 'q' query parameter.");
        return;
    }
    try {
        const apiResponseData = await youtubeApiRequest({
            url: "/search",
            params: { part: 'snippet', q: `${q} official music video`, type: 'video', maxResults: 6, },
        });
        response.status(200).send(apiResponseData);
    } catch (error: any) {
        logger.error(`Error in searchVideos for query "${q}":`, error);
        response.status(500).send("Server error during video search.");
    }
});

// --- generateQuiz FUNCTION (No change needed here, but ensure secrets array is updated) ---
export const generateQuiz = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    // ... This function's internal logic remains the same ...
    // Just make sure its "secrets" array includes "YOUTUBE_KEY_BACKUP"
    const YOUTUBE_API_KEY = process.env.YOUTUBE_KEY;
    const SUPADATA_API_KEY = process.env.SUPADATA_KEY;
    
    // The rest of this function is unchanged
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
            model: "gemini-2.5-pro",
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
// --- getVideoDetails FUNCTION (Refactored) ---
export const getVideoDetails = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    const { videoId } = request.query;
    if (typeof videoId !== 'string') {
        response.status(400).send("Missing 'videoId' query parameter.");
        return;
    }
    try {
        const apiResponseData = await youtubeApiRequest({
            url: "/videos",
            params: { part: 'contentDetails', id: videoId, },
        });
        response.status(200).send(apiResponseData);
    } catch (error: any) {
        logger.error(`Error in getVideoDetails for videoId "${videoId}":`, error);
        response.status(500).send("Server error during video details fetch.");
    }
});