<template>
  <div class="chart-container">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
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
  Filler,
} from 'chart.js';
import { valuationRepository } from '../data/repos';
import { Money } from '../core/Money';
import type { Valuation } from '../data/db';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const valuations = ref<Valuation[]>([]);

const chartData = computed(() => {
  const sortedValuations = [...valuations.value].sort((a, b) => new Date(a.asOf).getTime() - new Date(b.asOf).getTime());
  const labels = sortedValuations.map(v => new Date(v.asOf).toLocaleDateString());
  const data = sortedValuations.map(v => new Money(v.totalValue, 'EUR').getDecimal());

  return {
    labels,
    datasets: [
      {
        label: 'Portfolio Value',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        data: data,
        fill: true,
        tension: 0.4,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
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
      display: false,
    },
  }
};

onMounted(async () => {
  try {
    valuations.value = await valuationRepository.getAll();
  } catch (error) {
    console.error('Error fetching valuation data:', error);
  }
});
</script>

<style scoped>
.chart-container {
  height: 300px;
  position: relative;
}
</style>
