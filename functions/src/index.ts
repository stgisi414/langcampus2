import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import axios from "axios";

export const suggestV3 = onRequest({ cors: true }, async (request, response) => {
    logger.info("Suggest function triggered", { query: request.query });

    try {
        // THIS IS THE OFFICIAL, PUBLIC YOUTUBE DATA API V3 ENDPOINT
        const officialApiUrl = "https://www.googleapis.com/youtube/v3/search";
        
        const apiResponse = await axios.get(officialApiUrl, {
            params: {
                ...request.query, // This will include 'q' and 'key' from the frontend
                part: 'snippet',      // Required by the YouTube API
                type: 'video',        // We only want video suggestions
                maxResults: 10,       // Get up to 10 suggestions
            },
        });

        response.status(200).send(apiResponse.data);

    } catch (error) {
        logger.error("CRITICAL ERROR in suggest function:", error);
        response.status(500).send("The server function encountered a critical error.");
    }
});