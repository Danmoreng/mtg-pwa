<template>
  <div>
    <!-- Provider and finish selection controls -->
    <div class="d-flex justify-content-between mb-2">
      <div class="btn-group" role="group">
        <button 
          type="button" 
          class="btn btn-outline-primary btn-sm"
          :class="{ active: selectedFinish === 'nonfoil' }"
          @click="selectedFinish = 'nonfoil'"
        >
          Regular
        </button>
        <button 
          type="button" 
          class="btn btn-outline-primary btn-sm"
          :class="{ active: selectedFinish === 'foil' }"
          @click="selectedFinish = 'foil'"
        >
          Foil
        </button>
        <button 
          type="button" 
          class="btn btn-outline-primary btn-sm"
          :class="{ active: selectedFinish === 'etched' }"
          @click="selectedFinish = 'etched'"
        >
          Etched
        </button>
      </div>
      
      <div class="btn-group" role="group">
        <button 
          type="button" 
          class="btn btn-outline-secondary btn-sm"
          :class="{ active: selectedProvider === 'scryfall' }"
          @click="selectedProvider = 'scryfall'"
        >
          Scryfall
        </button>
        <button 
          type="button" 
          class="btn btn-outline-secondary btn-sm"
          :class="{ active: selectedProvider === 'mtgjson.cardmarket' }"
          @click="selectedProvider = 'mtgjson.cardmarket'"
        >
          MTGJSON
        </button>
        <button 
          type="button" 
          class="btn btn-outline-secondary btn-sm"
          :class="{ active: selectedProvider === 'cardmarket.priceguide' }"
          @click="selectedProvider = 'cardmarket.priceguide'"
        >
          Price Guide
        </button>
      </div>
    </div>
    
    <div style="height: 200px">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Money } from '../core/Money';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

const props = defineProps<{
  pricePoints: any[];
  transactions: any[];
}>();

// Selected filters
const selectedFinish = ref<'nonfoil' | 'foil' | 'etched'>('nonfoil');
const selectedProvider = ref<'scryfall' | 'mtgjson.cardmarket' | 'cardmarket.priceguide'>('scryfall');

// Filter price points based on selected finish and provider
const filteredPricePoints = computed(() => {
  return props.pricePoints.filter(pp => {
    // Filter by finish
    if (pp.finish !== selectedFinish.value) return false;
    
    // Filter by provider
    if (pp.provider !== selectedProvider.value) return false;
    
    return true;
  });
});

const sortedPricePoints = computed(() => {
  return [...filteredPricePoints.value].sort((a, b) => new Date(a.asOf).getTime() - new Date(b.asOf).getTime());
});

const chartData = computed(() => {
  const labels = sortedPricePoints.value.map(p => new Date(p.asOf).toLocaleDateString());
  const data = sortedPricePoints.value.map(p => new Money(p.priceCent, p.currency).getDecimal());
  
  // Add average lines if available (for Price Guide)
  const avg7dData = sortedPricePoints.value.map(p => 
    p.avg7dCent ? new Money(p.avg7dCent, p.currency).getDecimal() : 0
  ).filter((_, index) => sortedPricePoints.value[index].avg7dCent !== undefined);
  
  const avg30dData = sortedPricePoints.value.map(p => 
    p.avg30dCent ? new Money(p.avg30dCent, p.currency).getDecimal() : 0
  ).filter((_, index) => sortedPricePoints.value[index].avg30dCent !== undefined);

  const datasets = [
    {
      label: 'Price',
      backgroundColor: 'blue',
      borderColor: 'blue',
      data: data,
      fill: false,
      tension: 0.1,
    } as any
  ];
  
  // Add average lines if we're showing Price Guide data
  if (selectedProvider.value === 'cardmarket.priceguide') {
    datasets.push({
      label: '7-Day Avg',
      backgroundColor: 'rgba(0, 255, 0, 0.2)',
      borderColor: 'green',
      borderDash: [5, 5],
      data: avg7dData,
      fill: false,
      tension: 0.1,
    } as any);
    
    datasets.push({
      label: '30-Day Avg',
      backgroundColor: 'rgba(255, 0, 0, 0.2)',
      borderColor: 'red',
      borderDash: [10, 5],
      data: avg30dData,
      fill: false,
      tension: 0.1,
    } as any);
  }

  return {
    labels,
    datasets,
  };
});

const chartOptions = computed(() => {
  const annotations = props.transactions.map(t => {
    return {
      type: 'line' as const,
      yMin: new Money(t.unitPrice, t.currency).getDecimal(),
      yMax: new Money(t.unitPrice, t.currency).getDecimal(),
      borderColor: t.kind === 'buy' ? 'green' : 'red',
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        content: `${t.kind} @ ${new Money(t.unitPrice, t.currency).format('de-DE')}`,
        enabled: false,
      }
    }
  });

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0
    },
    scales: {
      y: {
        ticks: {
          callback: function(value: string | number) {
            if (typeof value === 'number') {
              return new Money(value * 100, 'EUR').format('de-DE');
            }
            return value;
          }
        }
      }
    },
    plugins: {
      legend: {
        display: true,
      },
      annotation: {
        annotations: annotations
      }
    }
  }
});
</script>
