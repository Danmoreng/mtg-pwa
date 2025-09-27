import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../features/dashboard/HomeView.vue';
import DataImportView from '../features/imports/views/DataImportView.vue';
import CardmarketImportWizard from '../features/imports/views/wizard/CardmarketImportWizard.vue';
import MtgjsonImportWizard from '../features/imports/views/wizard/MtgjsonImportWizard.vue';
import PriceGuideUploadWizard from '../features/imports/views/wizard/PriceGuideUploadWizard.vue';
import DeckImportView from '../features/decks/views/DeckImportView.vue';
import DecksView from '../features/decks/views/DecksView.vue';
import DeckDetailView from '../features/decks/views/DeckDetailView.vue';
import CardsView from '../features/cards/views/CardsView.vue';

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/import',
    component: DataImportView,
    children: [
      {
        path: '',
        name: 'import',
        redirect: '/import/cardmarket',
      },
      {
        path: 'cardmarket',
        name: 'import-cardmarket',
        component: CardmarketImportWizard,
      },
      {
        path: 'mtgjson',
        name: 'import-mtgjson',
        component: MtgjsonImportWizard,
      },
      {
        path: 'price-guide',
        name: 'import-price-guide',
        component: PriceGuideUploadWizard,
      },
      {
        path: 'manabox',
        name: 'import-manabox',
        component: () => import('../features/imports/views/ManaboxImportView.vue'),
      },
    ],
  },
  {
    path: '/import/deck',
    name: 'deck-import',
    component: DeckImportView,
  },
  {
    path: '/decks',
    name: 'decks',
    component: DecksView,
  },
  {
    path: '/decks/:id',
    name: 'deck-detail',
    component: DeckDetailView,
    props: true,
  },
  {
    path: '/cards',
    name: 'cards',
    component: CardsView,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
