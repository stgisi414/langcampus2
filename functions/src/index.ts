import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import axios from "axios";

// This is the simplest possible V2 function.
// The {cors: true} option handles CORS automatically.
export const suggest = onRequest({ cors: true }, async (request, response) => {
    // This is the very first thing the function will do.
    logger.info("Function has started successfully!", { query: request.query });

    try {
        const externalApiUrl = "https://clients1.google.com/complete/search";
        
        const apiResponse = await axios.get(externalApiUrl, {
            params: request.query,
        });

        // Send the successful response back to the browser.
        response.status(200).send(apiResponse.data);

    } catch (error) {
        // If anything goes wrong, we will log it.
        logger.error("CRITICAL ERROR in suggest function:", error);
        response.status(500).send("The server function encountered a critical error.");
    }
});