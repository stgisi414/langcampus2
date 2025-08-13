import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.SUPADATA_API_KEY': JSON.stringify(env.SUPADATA_API_KEY)
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        },
        build: {
          minify: false
        },
        preview: {
            port: 8080,
            host: true,
        },
        server: {
            port: 8080,
            proxy: {
                '/getVideoDetails': {
                    target: 'http://127.0.0.1:5001/langcampus-v2-96af4/us-central1/getVideoDetails',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/getVideoDetails/, ''),
                },
                '/suggestV3': { // <-- Change to suggestV3
                    target: 'https://us-central1-langcampus-v2-96af4.cloudfunctions.net',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/suggestV3/, '/suggestV3'), // <-- Change to suggestV3
                }
            }
        }
    };
});