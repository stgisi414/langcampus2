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
                '/suggest': {
                    target: 'https://clients1.google.com',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/suggest/, ''),
                }
            }
        }
    };
});