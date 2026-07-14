import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {
  Chart,
  ChartConfiguration,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  CategoryScale,
} from 'chart.js';
import { MonthlyTrendPoint } from '../../core/models';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
);

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

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderCharts();
  }

  ngOnChanges(): void {
    this.renderCharts();
  }

  ngOnDestroy(): void {
    this.ordersChart?.destroy();
    this.revenueChart?.destroy();
  }

  private renderCharts(): void {
    if (!this.viewReady || !this.trends.length) return;

    this.renderOrdersChart();
    this.renderRevenueChart();
  }

  private renderOrdersChart(): void {
    const canvas = this.ordersCanvas?.nativeElement;
    if (!canvas) return;

    const labels = this.trends.map((point) => point.label);
    const data = this.trends.map((point) => point.ordersCount);

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Pedidos recibidos',
            data,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            pointBackgroundColor: '#2563eb',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: this.baseLineOptions('Pedidos'),
    };

    if (this.ordersChart) {
      this.ordersChart.data = config.data;
      this.ordersChart.update();
      return;
    }

    this.ordersChart = new Chart(canvas, config);
  }

  private renderRevenueChart(): void {
    const canvas = this.revenueCanvas?.nativeElement;
    if (!canvas) return;

    const labels = this.trends.map((point) => point.label);
    const data = this.trends.map((point) => point.revenue);

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Ingresos totales',
            data,
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.12)',
            pointBackgroundColor: '#059669',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: this.baseLineOptions('Ingresos', true),
    };

    if (this.revenueChart) {
      this.revenueChart.data = config.data;
      this.revenueChart.update();
      return;
    }

    this.revenueChart = new Chart(canvas, config);
  }

  private baseLineOptions(
    yAxisLabel: string,
    currency = false,
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
              const formatted = currency ? formatCurrency(value) : `${value} pedidos`;
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
          title: {
            display: true,
            text: yAxisLabel,
            color: '#64748b',
            font: { size: 11, weight: 600 },
          },
          grid: {
            color: 'rgba(204, 229, 240, 0.8)',
          },
          ticks: {
            color: '#64748b',
            font: { size: 11 },
            callback: (value) => {
              const numeric = Number(value);
              return currency ? formatCurrency(numeric) : numeric;
            },
          },
        },
      },
    };
  }
}
