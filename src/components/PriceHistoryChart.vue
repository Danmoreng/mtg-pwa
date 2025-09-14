<template>
  <div>
    <div style="height: 200px">
      <Line :data="chartData" :options="chartOptions" />
    </div>
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
  pricePoints: Array<{
    date?: string;
    asOf?: string | Date;
    finish?: 'nonfoil' | 'foil' | 'etched';
    provider?: 'scryfall' | 'mtgjson.cardmarket' | 'cardmarket.priceguide' | string;
    priceCent?: number;
    currency?: string;
  }>;
  transactions: any[];
}>();

// Provider preference for merging (higher = better)
const providerRank: Record<string, number> = {
  'mtgjson.cardmarket': 3,
  'cardmarket.priceguide': 2,
  'scryfall': 1,
};

// Normalize -> merge (by finish+date) -> split into two series
const merged = computed(() => {
  const toISO = (d: any) => {
    try { return new Date(d).toISOString().slice(0, 10); } catch { return undefined; }
  };

  type Slot = { value: number; rank: number; asOfTs: number };
  const pick: Record<'nonfoil' | 'foil', Record<string, Slot>> = {
    nonfoil: {},
    foil: {},
  };

  // 1) consolidate by (finish, date)
  for (const pp of (props.pricePoints ?? [])) {
    const finish = (pp.finish || 'nonfoil') as 'nonfoil' | 'foil' | 'etched';
    if (finish === 'etched') continue; // not displayed
    const date = pp.date ?? (pp.asOf ? toISO(pp.asOf) : undefined);
    if (!date) continue;

    const rank = providerRank[pp.provider ?? ''] ?? 0;
    const asOfTs = pp.asOf ? new Date(pp.asOf as any).getTime() : 0;
    const value = (pp.priceCent ?? 0) / 100;

    const bucket = pick[finish];
    const prev = bucket[date];
    if (!prev || rank > prev.rank || (rank === prev.rank && asOfTs > prev.asOfTs)) {
      bucket[date] = { value, rank, asOfTs };
    }
  }

  // 2) build the union of dates across both finishes
  const dates = new Set<string>([
    ...Object.keys(pick.nonfoil),
    ...Object.keys(pick.foil),
  ]);
  // Sort ascending
  const sortedDates = Array.from(dates).sort((a, b) => a.localeCompare(b));

  // 3) arrays aligned to labels (null gaps allowed)
  const nonfoil = sortedDates.map(d => pick.nonfoil[d]?.value ?? null);
  const foil    = sortedDates.map(d => pick.foil[d]?.value ?? null);

  // For x-axis labels, show localized dates
  const labels = sortedDates.map(d => new Date(d).toLocaleDateString());

  return { labels, nonfoil, foil };
});

const chartData = computed(() => {
  return {
    labels: merged.value.labels,
    datasets: [
      {
        label: 'Regular',
        backgroundColor: 'rgba(13,110,253,0.15)',
        borderColor: '#0d6efd',
        pointRadius: 0,
        data: merged.value.nonfoil,
        fill: false,
        tension: 0.2,
      },
      {
        label: 'Foil',
        backgroundColor: 'rgba(32,201,151,0.15)',
        borderColor: '#20c997',
        pointRadius: 0,
        data: merged.value.foil,
        fill: false,
        tension: 0.2,
      },
    ],
  };
});

const chartOptions = computed(() => {
  const annotations = (props.transactions ?? []).map(t => ({
    type: 'line' as const,
    yMin: new Money(t.unitPrice, t.currency).getDecimal(),
    yMax: new Money(t.unitPrice, t.currency).getDecimal(),
    borderColor: /buy/i.test(t.kind) ? 'green' : 'red',
    borderWidth: 2,
    borderDash: [5, 5],
    label: {
      content: `${t.kind} @ ${new Money(t.unitPrice, t.currency).format('de-DE')}`,
      enabled: false,
    },
  }));

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    scales: {
      y: {
        ticks: {
          callback(value: string | number) {
            if (typeof value === 'number') {
              return new Money(value * 100, 'EUR').format('de-DE');
            }
            return value;
          },
        },
      },
      x: {
        ticks: { maxRotation: 0, autoSkip: true },
      },
    },
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          label(ctx: any) {
            const v = ctx.parsed.y;
            return `${ctx.dataset.label}: ${new Money(Math.round((v ?? 0) * 100), 'EUR').format('de-DE')}`;
          },
        },
      },
      annotation: { annotations },
    },
    elements: {
      line: { spanGaps: true }, // connect through null gaps
    },
  };
});
</script>
