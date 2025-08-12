import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import axios from "axios";

// This is the V2 function using the official YouTube Data API.
export const suggest = onRequest({ cors: true }, async (request, response) => {
    logger.info("Suggest function triggered", { query: request.query });

    try {
        // This is the official, public API endpoint.
        const officialApiUrl = "https://www.googleapis.com/youtube/v3/search";
        
        const apiResponse = await axios.get(officialApiUrl, {
            params: {
                ...request.query,
                part: 'snippet', // Required by the YouTube API
                type: 'video',    // We only want video suggestions
            },
        });

        // Send the successful response back to the browser.
        response.status(200).send(apiResponse.data);

    } catch (error) {
        logger.error("CRITICAL ERROR in suggest function:", error);
        response.status(500).send("The server function encountered a critical error.");
    }
});