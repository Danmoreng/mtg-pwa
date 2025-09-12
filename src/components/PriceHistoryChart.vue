<template>
  <div style="height: 200px">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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

const sortedPricePoints = computed(() => {
  return [...props.pricePoints].sort((a, b) => new Date(a.asOf).getTime() - new Date(b.asOf).getTime());
});

const chartData = computed(() => {
  const labels = sortedPricePoints.value.map(p => new Date(p.asOf).toLocaleDateString());
  const data = sortedPricePoints.value.map(p => new Money(p.price, p.currency).getDecimal());

  return {
    labels,
    datasets: [
      {
        label: 'Price',
        backgroundColor: 'blue',
        borderColor: 'blue',
        data: data,
        fill: false,
        tension: 0.1,
      },
    ],
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
        display: false,
      },
      annotation: {
        annotations: annotations
      }
    }
  }
});
</script>
