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
        // NEW: Add the server block with the proxy configuration
        server: {
            port: 8080,
            allowedHosts: [
                //'.ngrok-free.app', // Use a wildcard to allow all ngrok subdomains
                'localhost',
                '127.0.0.1'
            ],
            proxy: {
                '/suggest': {
                    target: 'https://clients1.google.com',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/suggest/, ''),
                }
            }
        }
    };
});