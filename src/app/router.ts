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
        path: '/',
        name: 'home',
        component: HomeView
    },
    {
        path: '/import/csv',
        name: 'csv-import',
        component: CsvImportView
    },
    {
        path: '/import/cardmarket',
        name: 'cardmarket-import',
        component: CardmarketImportWizard
    },
    {
        path: '/import/deck',
        name: 'deck-import',
        component: DeckImportView
    },
    {
        path: '/decks',
        name: 'decks',
        component: DecksView
    },
    {
        path: '/decks/:id',
        name: 'deck-detail',
        component: DeckDetailView,
        props: true
    },
    {
        path: '/cards',
        name: 'cards',
        component: CardsView
    }
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes
})

export default router