import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {VitePWA} from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            devOptions: {
                enabled: true
            },
            strategies: 'injectManifest',
            srcDir: 'src',
            outDir: "./page",
            filename: 'sw.ts',
            manifest: {
                name: 'MTG Collection Value Tracker',
                short_name: 'MTG Tracker',
                description: 'Track your Magic: The Gathering collection value',
                theme_color: '#ffffff',
                icons: [
                    {
                        src: 'src/assets/logo.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'src/assets/logo.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ],
    build: {
        outDir: "./page",
    }
})
