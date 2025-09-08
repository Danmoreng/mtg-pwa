import {createRouter, createWebHistory} from 'vue-router'
import HomeView from '../features/dashboard/HomeView.vue'
import CsvImportView from '../features/imports/views/CsvImportView.vue'
import CardmarketImportWizard from '../features/imports/views/wizard/CardmarketImportWizard.vue'
import DeckImportView from '../features/decks/views/DeckImportView.vue'
import DecksView from '../features/decks/views/DecksView.vue'
import DeckDetailView from '../features/decks/views/DeckDetailView.vue'
import CardsView from '../features/cards/views/CardsView.vue'

const routes = [
    {
        path: '/mtg-pwa/',
        name: 'home',
        component: HomeView
    },
    {
        path: '/mtg-pwa/import/csv',
        name: 'csv-import',
        component: CsvImportView
    },
    {
        path: '/mtg-pwa/import/cardmarket',
        name: 'cardmarket-import',
        component: CardmarketImportWizard
    },
    {
        path: '/mtg-pwa/import/deck',
        name: 'deck-import',
        component: DeckImportView
    },
    {
        path: '/mtg-pwa/decks',
        name: 'decks',
        component: DecksView
    },
    {
        path: '/mtg-pwa/decks/:id',
        name: 'deck-detail',
        component: DeckDetailView,
        props: true
    },
    {
        path: '/mtg-pwa/cards',
        name: 'cards',
        component: CardsView
    }
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes
})

export default router