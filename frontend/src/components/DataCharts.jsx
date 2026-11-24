import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend)

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'bottom', labels: { color: '#647670', usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 18, font: { family: 'Fustat', size: 11 } } },
    tooltip: { backgroundColor: '#123b50', titleFont: { family: 'Fustat', weight: '600' }, bodyFont: { family: 'Fustat' }, padding: 11, cornerRadius: 9, displayColors: true },
  },
  scales: {
    x: { grid: { display: false }, border: { display: false }, ticks: { color: '#81918a', font: { family: 'Fustat', size: 10 }, maxRotation: 0, autoSkip: true } },
    y: { beginAtZero: true, border: { display: false }, grid: { color: '#edf1ef', drawTicks: false }, ticks: { color: '#81918a', padding: 9, font: { family: 'Fustat', size: 10 }, precision: 0 } },
  },
}

function EmptyChart({ label = 'Ainda não há dados neste período.' }) {
  return <div className="chart-empty"><span className="chart-empty-mark" aria-hidden="true">—</span><p>{label}</p></div>
}

function shortDate(value) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

export function ActivityChart({ rows = [], compact = false }) {
  if (!rows.length) return <EmptyChart />
  const options = {
    ...baseOptions,
    plugins: { ...baseOptions.plugins, legend: { ...baseOptions.plugins.legend, display: !compact } },
    scales: {
      ...baseOptions.scales,
      x: { ...baseOptions.scales.x, ticks: { ...baseOptions.scales.x.ticks, maxTicksLimit: compact ? 4 : 8, font: { family: 'Fustat', size: compact ? 9 : 10 } } },
      y: { ...baseOptions.scales.y, ticks: { ...baseOptions.scales.y.ticks, maxTicksLimit: compact ? 3 : 6, font: { family: 'Fustat', size: compact ? 9 : 10 } }, title: { display: !compact, text: 'Eventos de movimento', color: '#81918a', font: { family: 'Fustat', size: 10 } } },
    },
    elements: { line: { tension: 0.28 }, point: { radius: compact ? 2 : 3, hoverRadius: 5, borderWidth: 2 } },
  }
  return <div className={`chart-canvas${compact ? ' is-compact' : ''}`}><Line
    data={{
      labels: rows.map((row) => shortDate(row.date)),
      datasets: [
        { label: 'Atividade registrada', data: rows.map((row) => row.events), borderColor: '#0d3851', backgroundColor: 'rgba(13,56,81,.06)', fill: !compact, pointBackgroundColor: '#35a879', pointBorderColor: '#fff', borderWidth: 2.3 },
        ...(rows.some((row) => row.reference != null) ? [{ label: 'Referência habitual', data: rows.map((row) => row.reference), borderColor: '#91afa4', backgroundColor: 'transparent', borderDash: [5, 5], pointRadius: 0, borderWidth: 1.5, spanGaps: false }] : []),
      ],
    }} options={options} aria-label="Gráfico de atividade por dia" role="img" />
  </div>
}

export function EnvironmentChart({ readings = [], metric, compact = false }) {
  const rows = readings.filter((reading) => reading.metric === metric)
  if (!rows.length) return <EmptyChart label="Sem leituras ambientais neste período." />
  const labels = rows.map((row) => new Date(row.observed_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))
  const color = metric === 'temperatura' ? '#35a879' : '#629e92'
  const unit = metric === 'temperatura' ? '°C' : '%'
  return <div className={`chart-canvas${compact ? ' is-compact' : ''}`}><Line
    data={{ labels, datasets: [{ label: metric === 'temperatura' ? 'Temperatura' : 'Umidade relativa', data: rows.map((row) => row.value), borderColor: color, backgroundColor: metric === 'temperatura' ? 'rgba(53,168,121,.10)' : 'rgba(98,158,146,.10)', fill: true, pointRadius: compact ? 1 : 2.5, pointHoverRadius: 5, borderWidth: 2, spanGaps: false }] }}
    options={{ ...baseOptions, plugins: { ...baseOptions.plugins, legend: { ...baseOptions.plugins.legend, display: false }, tooltip: { ...baseOptions.plugins.tooltip, callbacks: { label: (item) => `${numberFormat.format(item.parsed.y)} ${unit}` } } }, scales: { ...baseOptions.scales, y: { ...baseOptions.scales.y, title: { display: !compact, text: unit, color: '#81918a', font: { family: 'Fustat', size: 10 } } } }, elements: { line: { tension: 0.18 } } }} aria-label={`Gráfico de ${metric}`} role="img" />
  </div>
}

export function RoomActivityChart({ rows = [], compact = false }) {
  if (!rows.length) return <EmptyChart label="Ainda não há movimentações por ambiente neste período." />
  return <div className={`chart-canvas${compact ? ' is-compact' : ''}`}><Bar
    data={{ labels: rows.map((row) => row.room), datasets: [{ label: 'Eventos de movimento', data: rows.map((row) => row.events), backgroundColor: ['#0d3851', '#35a879', '#629e92', '#a8c4b6', '#d3e2da'], borderRadius: 5, borderSkipped: false, maxBarThickness: 24 }] }}
    options={{ ...baseOptions, indexAxis: 'y', plugins: { ...baseOptions.plugins, legend: { display: false }, tooltip: { ...baseOptions.plugins.tooltip, callbacks: { label: (item) => `${numberFormat.format(item.parsed.x)} eventos` } } }, scales: { x: { ...baseOptions.scales.y, beginAtZero: true, ticks: { ...baseOptions.scales.y.ticks, precision: 0 } }, y: { ...baseOptions.scales.x, ticks: { ...baseOptions.scales.x.ticks, autoSkip: false } } } }} aria-label="Gráfico comparativo de movimento por ambiente" role="img" />
  </div>
}
