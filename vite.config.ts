import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import RekaResolver from 'reka-ui/resolver'
import {VitePWA} from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
    base: '/mtg-pwa/',
    plugins: [
        vue(),
        Components({
            dts: true,              // generates components.d.ts for TS IntelliSense
            resolvers: [RekaResolver()],
        }),
        VitePWA({
            registerType: 'autoUpdate',
            devOptions: {
                enabled: true
            },
            strategies: 'injectManifest',
            srcDir: 'src',
            outDir: "./docs",
            filename: 'sw.ts',
            manifest: {
                name: 'MTG Collection Value Tracker',
                short_name: 'MTG Tracker',
                description: 'Track your Magic: The Gathering collection value',
                theme_color: '#ffffff',
                start_url: '/mtg-pwa/',
                scope: '/mtg-pwa/',
                icons: [
                    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icons/icon-256.png', sizes: '256x256', type: 'image/png' },
                    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                ]
            }
        })
    ],
    build: {
        outDir: "./docs",
    }
})
