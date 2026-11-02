import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import type {
  Chart,
  ChartConfiguration,
} from 'chart.js';
import { MonthlyTrendPoint } from '../../core/models';

const COLOR_SOLD = '#15803d';
const COLOR_COLLECTED = '#0e7aab';
const COLOR_ORDERS = '#0e7aab';

function formatAxisCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1000) {
    const thousands = abs / 1000;
    const text = Number.isInteger(thousands)
      ? String(thousands)
      : thousands.toFixed(1);
    return `${sign}$${text}k`;
  }
  return `${sign}$${abs}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

@Component({
  selector: 'app-dashboard-monthly-trends',
  standalone: true,
  templateUrl: './dashboard-monthly-trends.component.html',
  styleUrl: './dashboard-monthly-trends.component.scss',
})
export class DashboardMonthlyTrendsComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input({ required: true }) trends: MonthlyTrendPoint[] = [];

  @ViewChild('ordersCanvas')
  private ordersCanvas?: ElementRef<HTMLCanvasElement>;

  @ViewChild('revenueCanvas')
  private revenueCanvas?: ElementRef<HTMLCanvasElement>;

  private ordersChart?: Chart<'line'>;
  private revenueChart?: Chart<'line'>;
  private viewReady = false;
  private destroyed = false;
  private chartApi: typeof import('chart.js') | null = null;
  private chartLoad: Promise<typeof import('chart.js')> | null = null;
  private renderGeneration = 0;

  get totalOrders(): number {
    return this.trends.reduce((sum, point) => sum + point.ordersCount, 0);
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    void this.renderCharts();
  }

  ngOnChanges(): void {
    void this.renderCharts();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.ordersChart?.destroy();
    this.revenueChart?.destroy();
  }

  private async ensureChartApi(): Promise<typeof import('chart.js')> {
    if (this.chartApi) {
      return this.chartApi;
    }
    if (!this.chartLoad) {
      this.chartLoad = import('chart.js').then((mod) => {
        mod.Chart.register(
          mod.LineController,
          mod.LineElement,
          mod.PointElement,
          mod.LinearScale,
          mod.CategoryScale,
          mod.Tooltip,
          mod.Legend,
          mod.Filler,
        );
        this.chartApi = mod;
        return mod;
      });
    }
    return this.chartLoad;
  }

  private async renderCharts(): Promise<void> {
    if (!this.viewReady || !this.trends.length || this.destroyed) return;

    const generation = ++this.renderGeneration;
    const { Chart } = await this.ensureChartApi();
    if (this.destroyed || generation !== this.renderGeneration) return;

    this.renderOrdersChart(Chart);
    this.renderRevenueChart(Chart);
  }

  private renderOrdersChart(ChartCtor: typeof Chart): void {
    const canvas = this.ordersCanvas?.nativeElement;
    if (!canvas) return;

    const labels = this.trends.map(
      (point) => point.label.split(' ')[0] ?? point.label,
    );
    const data = this.trends.map((point) => point.ordersCount);

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Pedidos recibidos',
            data,
            borderColor: COLOR_ORDERS,
            backgroundColor: 'rgba(14, 122, 171, 0.14)',
            pointBackgroundColor: COLOR_ORDERS,
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            pointRadius: 3.5,
            pointHoverRadius: 6,
            borderWidth: 2.5,
            fill: true,
            tension: 0,
          },
        ],
      },
      options: this.baseLineOptions(false, true),
    };

    if (this.ordersChart) {
      this.ordersChart.data = config.data;
      this.ordersChart.update();
      return;
    }

    this.ordersChart = new ChartCtor(canvas, config);
  }

  private renderRevenueChart(ChartCtor: typeof Chart): void {
    const canvas = this.revenueCanvas?.nativeElement;
    if (!canvas) return;

    const labels = this.trends.map(
      (point) => point.label.split(' ')[0] ?? point.label,
    );
    const sold = this.trends.map((point) => point.revenue);
    const collected = this.trends.map((point) => point.collected ?? 0);

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Vendido',
            data: sold,
            borderColor: COLOR_SOLD,
            backgroundColor: 'rgba(21, 128, 61, 0.10)',
            pointBackgroundColor: COLOR_SOLD,
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            pointRadius: 3.5,
            pointHoverRadius: 6,
            borderWidth: 2.5,
            fill: true,
            tension: 0,
          },
          {
            label: 'Cobrado',
            data: collected,
            borderColor: COLOR_COLLECTED,
            backgroundColor: 'transparent',
            pointBackgroundColor: COLOR_COLLECTED,
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            pointRadius: 3.5,
            pointHoverRadius: 6,
            borderWidth: 2.5,
            borderDash: [6, 4],
            fill: false,
            tension: 0,
          },
        ],
      },
      options: this.baseLineOptions(true),
    };

    if (this.revenueChart) {
      this.revenueChart.data = config.data;
      this.revenueChart.update();
      return;
    }

    this.revenueChart = new ChartCtor(canvas, config);
  }

  private baseLineOptions(
    currency = false,
    integer = false,
  ): ChartConfiguration<'line'>['options'] {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const value = context.parsed.y ?? 0;
              const formatted = currency
                ? formatCurrency(value)
                : `${value} pedidos`;
              return ` ${context.dataset.label}: ${formatted}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: '#64748b',
            font: { size: 11 },
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(226, 232, 240, 0.9)',
          },
          border: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { size: 11 },
            maxTicksLimit: 4,
            ...(integer ? { precision: 0 } : {}),
            callback: (value) => {
              const numeric = Number(value);
              return currency ? formatAxisCurrency(numeric) : numeric;
            },
          },
        },
      },
    };
  }
}
