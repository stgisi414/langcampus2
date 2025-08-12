import * as functions from "firebase-functions";
import axios from "axios";
import * as cors from "cors";

// Initialize a CORS handler to allow requests from your web app
const corsHandler = cors({origin: true});

// This is your new Cloud Function named 'suggest'
export const suggest = functions.https.onRequest((request, response) => {
  // Handle CORS for browser security
  corsHandler(request, response, async () => {
    try {
      // The original URL your Vite proxy was calling
      const externalApiUrl = "https://clients1.google.com/complete/search";
      
      // Pass along the query parameters from the original request
      const fullUrl = externalApiUrl + request.url;

      const apiResponse = await axios.get(fullUrl, {
          // It's good practice to forward the user-agent header
          headers: { "User-Agent": request.headers["user-agent"] },
      });

      // Send the response from the Google API back to your frontend
      response.status(apiResponse.status).send(apiResponse.data);

    } catch (error) {
      console.error("Error in proxy function:", error);
      response.status(500).send("Proxy error");
    }
  });
});