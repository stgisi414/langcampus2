import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import axios, { AxiosRequestConfig } from "axios";
import * as admin from "firebase-admin";

// Use the server-side SDK for most functions
import { GoogleGenerativeAI, Part, HarmCategory, HarmBlockThreshold, SchemaType, FunctionDeclarationSchema } from "@google/generative-ai";
// Use the client-side SDK (which has the correct TTS helper) specifically for the TTS function
import { GoogleGenAI } from "@google/genai";

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Define the secrets your functions will need
const secrets = ["YOUTUBE_KEY", "YOUTUBE_KEY_BACKUP", "SUPADATA_KEY"];

// --- Reusable YouTube API Requester with Fallback Logic ---
const youtubeApiRequest = async (config: AxiosRequestConfig) => {
    const PRIMARY_KEY = process.env.YOUTUBE_KEY;
    const BACKUP_KEY = process.env.YOUTUBE_KEY_BACKUP;
    const baseUrl = "https://www.googleapis.com/youtube/v3";

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
        const isQuotaError = error.response?.status === 403 &&
                             error.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded';

        if (isQuotaError && BACKUP_KEY) {
            logger.warn("Primary YouTube API key quota exceeded. Falling back to backup key.");
            const fallbackConfig = {
                ...config,
                url: `${baseUrl}${config.url}`,
                params: { ...config.params, key: BACKUP_KEY }
            };
            const fallbackResponse = await axios(fallbackConfig);
            return fallbackResponse.data;
        } else {
            logger.error("YouTube API request failed with a non-quota error or no backup key is available.");
            throw error;
        }
    }
};

// --- suggestV3 FUNCTION ---
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

// --- getPopularVideos CACHING FUNCTION ---
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

// --- searchVideos FUNCTION ---
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

// --- generateQuiz FUNCTION ---
export const generateQuiz = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_KEY;
    const SUPADATA_API_KEY = process.env.SUPADATA_KEY;
    
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
                matching: {
                    type: SchemaType.ARRAY,
                    description: "An array of 4-5 pairs for a matching activity based on the lyrics. This could be vocabulary words and definitions, or the start and end of phrases.",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            prompt: { type: SchemaType.STRING, description: "The item to be matched (e.g., a word or the start of a phrase)." },
                            answer: { type: SchemaType.STRING, description: "The corresponding correct match." }
                        },
                        required: ["prompt", "answer"]
                    }
                },
                sequencing: {
                    type: SchemaType.ARRAY,
                    description: "An array of 4-5 consecutive lyric lines from the song that the user should put in the correct order.",
                    items: { type: SchemaType.STRING }
                }
            },
            required: ["questions", "matching", "sequencing"],
        };
        
        const textPart: Part = {
            text: `Please create a fill-in-the-blank lyrics quiz, a matching activity, and a sequencing activity for the provided music video.
            
            Here is additional context for the video:
            - Video Title: "${videoSnippet.title}"
            - Video Description: "${videoDescription}"
            - Video Tags: "${videoTags}"
            - Full Song Transcript: "${fullTranscript}"
            - Video Duration: ${videoDuration}

            IMPORTANT INSTRUCTIONS:
            1.  Base all activities *directly* on the provided transcript.
            2.  For the main quiz: Generate as many high-quality questions as possible. Each question in the 'questions' array MUST be an object containing all of the following fields: 'timestamp', 'precedingLyric', 'question', 'options' (an array of 4 strings), and 'correctAnswer'.
            3.  For the matching activity: Create 4-5 pairs. These can be key vocabulary words from the lyrics and their definitions, or the first half of a lyric and the second half.
            4.  For the sequencing activity: Select a block of 4-5 consecutive lines from the song for the user to reorder.
            5.  The user's chosen language is ${language}. Generate ALL content (questions, options, matching prompts/answers, and sequencing lines) in ${language}.
            6.  FIX: EXTREMELY IMPORTANT: Only use lyrics that are in the user's chosen language of ${language}.
            7.  CRITICAL TIMING CONSTRAINT: The timestamp for the final quiz question absolutely MUST be at least 20 seconds less than the total video duration (${videoDuration}). Do not place any questions within the last 20 seconds of the video.
            8.  CRITICAL RULE FOR PRECEDING LYRIC: The 'precedingLyric' MUST be the full line of lyric that comes directly *before* the line that the question is about. It MUST NOT contain the answer or any part of the question itself.`

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

// --- getVideoDetails FUNCTION ---
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

// --- getSummary FUNCTION ---
export const getSummary = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_KEY;
    if (!YOUTUBE_API_KEY) {
        logger.error("API key is not set in the environment.");
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
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const textPart: Part = {
            text: `Provide a concise summary of the following music video in ${language}. Do not include any pre-text or conversational phrases.`,
        };
        const videoPart: Part = {
            fileData: {
                mimeType: 'video/youtube',
                fileUri: videoUrl
            }
        };

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [videoPart, textPart] }],
        });

        const summary = result.response?.text();
        if (summary) {
            response.status(200).send({ summary });
        } else {
            throw new Error("Could not generate a summary for this video.");
        }
    } catch (error: any) {
        logger.error(`Error generating summary for videoId "${videoId}":`, error);
        response.status(500).send("Failed to generate summary.");
    }
});

// --- generateTts FUNCTION (DEFINITIVE FIX) ---
export const generateTts = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_KEY;
    if (!YOUTUBE_API_KEY) {
        logger.error("API key is not set in the environment.");
        response.status(500).send("Server configuration error.");
        return;
    }
    
    // Use the client-side SDK here because it works correctly for the TTS model
    const genAI = new GoogleGenAI({ apiKey: YOUTUBE_API_KEY });

    const { text, lang } = request.query;

    if (typeof text !== 'string' || typeof lang !== 'string') {
        response.status(400).send("Missing 'text' or 'lang' parameter.");
        return;
    }

    try {
        const languageCodeMap: Record<string, string> = {
            'English': 'en-US', 'Spanish': 'es-US', 'French': 'fr-FR', 'German': 'de-DE',
            'Japanese': 'ja-JP', 'Korean': 'ko-KR', 'Italian': 'it-IT', 'Portuguese': 'pt-BR',
            'Russian': 'ru-RU', 'Arabic': 'ar-EG', 'Chinese': 'zh-CN', 'Hindi': 'hi-IN',
            'Turkish': 'tr-TR', 'Polish': 'pl-PL', 'Dutch': 'nl-NL', 'Swedish': 'sv-SE',
            'Finnish': 'fi-FI',
        };

        const voiceConfigMap: Record<string, any> = {
            'en-US': { prebuiltVoiceConfig: { voiceName: 'Kore' } }, 'es-US': { prebuiltVoiceConfig: { voiceName: 'Puck' } },
            'fr-FR': { prebuiltVoiceConfig: { voiceName: 'Leda' } }, 'de-DE': { prebuiltVoiceConfig: { voiceName: 'Charon' } },
            'ja-JP': { prebuiltVoiceConfig: { voiceName: 'Aoede' } }, 'ko-KR': { prebuiltVoiceConfig: { voiceName: 'Orus' } },
            'it-IT': { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }, 'pt-BR': { prebuiltVoiceConfig: { voiceName: 'Umbriel' } },
            'ru-RU': { prebuiltVoiceConfig: { voiceName: 'Iapetus' } }, 'ar-EG': { prebuiltVoiceConfig: { voiceName: 'Algieba' } },
            'zh-CN': { prebuiltVoiceConfig: { voiceName: 'Achernar' } }, 'hi-IN': { prebuiltVoiceConfig: { voiceName: 'Alnilam' } },
            'tr-TR': { prebuiltVoiceConfig: { voiceName: 'Gacrux' } }, 'pl-PL': { prebuiltVoiceConfig: { voiceName: 'Pulcherrima' } },
            'nl-NL': { prebuiltVoiceConfig: { voiceName: 'Achird' } }, 'sv-SE': { prebuiltVoiceConfig: { voiceName: 'Zubenelgenubi' } },
            'fi-FI': { prebuiltVoiceConfig: { voiceName: 'Vindemiatrix' } },
        };

        const languageCode = languageCodeMap[lang];
        if (!languageCode) {
            throw new Error(`Unsupported language: ${lang}`);
        }

        let processedText = text;
        if (text.trim().length <= 2) {
            processedText = `<break time="150ms"/>${text}<break time="150ms"/>`;
        }

        const contentText = `<speak><lang xml:lang="${languageCode}">${processedText}</lang></speak>`;
        const voiceConfig = voiceConfigMap[languageCode] || voiceConfigMap['en-US'];

        // Replicating the exact, working structure from the original client-side code
        const ttsResponse = await genAI.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text: contentText }] }],
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    ...voiceConfig,
                    languageCode: languageCode
                },
            },
        });

        const candidate = ttsResponse.candidates?.[0];

        // This safety check resolves the "Object is possibly 'undefined'" error
        if (!candidate || !candidate.content || !candidate.content.parts) {
            throw new Error("Invalid TTS API response structure: No valid candidates or content found.");
        }
        
        const audioPart = candidate.content.parts.find((part: any) => part.inlineData);

        if (audioPart && audioPart.inlineData) {
            response.setHeader('Content-Type', 'application/json');
            response.status(200).send({ audioContent: audioPart.inlineData.data });
            return;
        }

        throw new Error("No audio data received from TTS API.");

    } catch (error: any) {
        logger.error(`Error generating TTS for text "${text}" in language "${lang}":`, error.response?.data || error.message);
        response.status(500).send("Failed to generate audio.");
    }
});

// --- translateText FUNCTION ---
export const translateText = onRequest({ cors: true, invoker: 'public', secrets }, async (request, response) => {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_KEY;
    if (!YOUTUBE_API_KEY) {
        logger.error("API key is not set in the environment.");
        response.status(500).send("Server configuration error.");
        return;
    }

    const genAI = new GoogleGenerativeAI(YOUTUBE_API_KEY);
    const { text, targetLang, sourceLang } = request.query;

    if (typeof text !== 'string' || typeof targetLang !== 'string' || typeof sourceLang !== 'string') {
        response.status(400).send("Missing 'text', 'targetLang', or 'sourceLang' parameter.");
        return;
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        
        // FIX: Update the prompt to request markdown formatting
        const prompt = `Translate the following text from ${sourceLang} to ${targetLang}: "${text}". 
        Additionally, provide a brief explanation of the phrase's meaning or context in the target language.
        Format your entire response using **Markdown**, with a heading for the translation and a separate section for the explanation. 
        DO NOT include any conversational pre-text or apologies.`;

        const result = await model.generateContent(prompt);
        const translatedText = result.response?.text();

        if (translatedText) {
            response.status(200).send({ translatedText });
        } else {
            throw new Error("Could not translate the text.");
        }
    } catch (error: any) {
        logger.error(`Error translating text:`, error);
        response.status(500).send("Failed to translate text.");
    }
});