// Motor de regras do Sales Diagnostic Engine (SDE) — diagnostico de funil de
// vendas em marketplaces. Logica pura e testavel: nenhuma chamada a banco ou
// API externa entra aqui (isso fica em funnel-diagnostic.service.ts).

export interface FunnelSnapshotInput {
  impressions: number
  clicks: number
  visits: number
  addToCart: number
  orders: number
  revenue: number
  adSpend: number
  unitCost: number | null
}

export interface FunnelMetrics {
  impressions: number
  clicks: number
  visits: number
  addToCart: number
  orders: number
  ctr: number | null            // clicks / impressions
  atcRate: number | null        // addToCart / visits
  conversionRate: number | null // orders / visits
  abandonmentRate: number | null // (addToCart - orders) / addToCart
}

export interface UnitEconomics {
  revenue: number
  adSpend: number
  unitCost: number | null
  orders: number
  avgTicket: number | null            // revenue / orders
  roas: number | null                 // revenue / adSpend
  acos: number | null                 // adSpend / revenue
  contributionMargin: number | null   // (revenue - unitCost*orders - adSpend) / revenue
}

export interface BenchmarkRange {
  min: number
  max: number
}

export interface FunnelBenchmarks {
  ctr: BenchmarkRange
  atcRate: BenchmarkRange
  conversionRate: BenchmarkRange
  abandonmentRate: BenchmarkRange
}

// Faixas padrao por nicho (autopecas) — usadas até a conta acumular historico
// proprio (recomendado: substituir pela mediana das ultimas 3-4 semanas).
export const DEFAULT_BENCHMARKS: FunnelBenchmarks = {
  ctr: { min: 0.01, max: 0.03 },
  atcRate: { min: 0.05, max: 0.10 },
  conversionRate: { min: 0.01, max: 0.04 },
  abandonmentRate: { min: 0.60, max: 0.75 },
}

const MIN_CONTRIBUTION_MARGIN = 0.10
const REACH_DROP_THRESHOLD = 0.30 // queda de 30%+ vs media historica aciona alerta de alcance

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

export function computeFunnelMetrics(snapshot: FunnelSnapshotInput): FunnelMetrics {
  return {
    impressions: snapshot.impressions,
    clicks: snapshot.clicks,
    visits: snapshot.visits,
    addToCart: snapshot.addToCart,
    orders: snapshot.orders,
    ctr: ratio(snapshot.clicks, snapshot.impressions),
    atcRate: ratio(snapshot.addToCart, snapshot.visits),
    conversionRate: ratio(snapshot.orders, snapshot.visits),
    abandonmentRate: ratio(snapshot.addToCart - snapshot.orders, snapshot.addToCart),
  }
}

export function computeUnitEconomics(snapshot: FunnelSnapshotInput): UnitEconomics {
  const avgTicket = ratio(snapshot.revenue, snapshot.orders)
  const roas = ratio(snapshot.revenue, snapshot.adSpend)
  const acos = ratio(snapshot.adSpend, snapshot.revenue)

  const totalCost = snapshot.unitCost != null ? snapshot.unitCost * snapshot.orders : null
  const contributionMargin = totalCost != null && snapshot.revenue > 0
    ? (snapshot.revenue - totalCost - snapshot.adSpend) / snapshot.revenue
    : null

  return {
    revenue: snapshot.revenue,
    adSpend: snapshot.adSpend,
    unitCost: snapshot.unitCost,
    orders: snapshot.orders,
    avgTicket,
    roas,
    acos,
    contributionMargin,
  }
}

export type Gargalo =
  | 'ALCANCE'
  | 'ATRACAO'
  | 'CONVERSAO'
  | 'ABANDONO_CHECKOUT'
  | 'RENTABILIDADE'
  | 'SAUDAVEL'

export interface DiagnosisRuleResult {
  gargalo: Gargalo
  regraDisparada: string
  causaProvavelSugerida: string
  ganhoPotencialEstimado: number
}

// Ganho potencial (R$) = (benchmark - atual) x volume da etapa anterior x ticket medio x margem
// Formula do documento de estrategia do SDE — usada para priorizar as acoes em R$.
export function calculatePotentialGain(params: {
  benchmark: number
  current: number
  previousStageVolume: number
  avgTicket: number
  marginRate: number
}): number {
  const gap = Math.max(0, params.benchmark - params.current)
  return gap * params.previousStageVolume * params.avgTicket * params.marginRate
}

// Arvore de diagnostico: avalia o funil do topo para a base — a primeira
// regra que dispara e o gargalo principal, pois etapas a jusante nao podem
// ser avaliadas com confianca enquanto uma etapa anterior estiver quebrada.
export function applyDiagnosisTree(
  metrics: FunnelMetrics,
  economics: UnitEconomics,
  benchmarks: FunnelBenchmarks = DEFAULT_BENCHMARKS,
  historicalAvgImpressions: number | null = null,
): DiagnosisRuleResult {
  const margin = economics.contributionMargin ?? 0.2
  const avgTicket = economics.avgTicket ?? 0

  // Regra 1 — baixo alcance vs historico do proprio anuncio
  if (historicalAvgImpressions != null && historicalAvgImpressions > 0) {
    const drop = (historicalAvgImpressions - metrics.impressions) / historicalAvgImpressions
    if (drop >= REACH_DROP_THRESHOLD) {
      return {
        gargalo: 'ALCANCE',
        regraDisparada: `Impressões caíram ${(drop * 100).toFixed(0)}% vs. média histórica (${historicalAvgImpressions.toFixed(0)})`,
        causaProvavelSugerida: 'Possível perda de ranking/SEO do anúncio (título, categoria, atributos, reputação da loja)',
        ganhoPotencialEstimado: calculatePotentialGain({
          benchmark: historicalAvgImpressions,
          current: metrics.impressions,
          previousStageVolume: 1,
          avgTicket: avgTicket * (metrics.conversionRate ?? benchmarks.conversionRate.min),
          marginRate: margin,
        }),
      }
    }
  }

  // Regra 2 — bom alcance, CTR abaixo do benchmark
  if (metrics.ctr != null && metrics.ctr < benchmarks.ctr.min) {
    return {
      gargalo: 'ATRACAO',
      regraDisparada: `CTR de ${(metrics.ctr * 100).toFixed(2)}% abaixo do benchmark mínimo (${(benchmarks.ctr.min * 100).toFixed(1)}%)`,
      causaProvavelSugerida: 'Imagem de capa, preço exibido ou avaliações pouco competitivos frente aos concorrentes',
      ganhoPotencialEstimado: calculatePotentialGain({
        benchmark: benchmarks.ctr.min,
        current: metrics.ctr,
        previousStageVolume: metrics.impressions,
        avgTicket: avgTicket * (metrics.conversionRate ?? benchmarks.conversionRate.min),
        marginRate: margin,
      }),
    }
  }

  // Regra 3 — boa atração, conversão abaixo do benchmark
  if (metrics.conversionRate != null && metrics.conversionRate < benchmarks.conversionRate.min) {
    return {
      gargalo: 'CONVERSAO',
      regraDisparada: `Taxa de conversão de ${(metrics.conversionRate * 100).toFixed(2)}% abaixo do benchmark mínimo (${(benchmarks.conversionRate.min * 100).toFixed(1)}%)`,
      causaProvavelSugerida: 'Página do produto, oferta ou condições de frete não convencem o comprador na decisão final',
      ganhoPotencialEstimado: calculatePotentialGain({
        benchmark: benchmarks.conversionRate.min,
        current: metrics.conversionRate,
        previousStageVolume: metrics.visits,
        avgTicket,
        marginRate: margin,
      }),
    }
  }

  // Regra 4 — boa intenção de compra (ATC alto), abandono de checkout alto
  if (
    metrics.atcRate != null && metrics.atcRate >= benchmarks.atcRate.min &&
    metrics.abandonmentRate != null && metrics.abandonmentRate > benchmarks.abandonmentRate.max
  ) {
    return {
      gargalo: 'ABANDONO_CHECKOUT',
      regraDisparada: `Taxa de abandono de ${(metrics.abandonmentRate * 100).toFixed(1)}% acima do benchmark máximo (${(benchmarks.abandonmentRate.max * 100).toFixed(0)}%)`,
      causaProvavelSugerida: 'Custo de frete, prazo de entrega ou opções de pagamento estão afastando o comprador no checkout',
      ganhoPotencialEstimado: calculatePotentialGain({
        benchmark: benchmarks.abandonmentRate.max,
        current: metrics.abandonmentRate,
        previousStageVolume: metrics.addToCart,
        avgTicket,
        marginRate: margin,
      }),
    }
  }

  // Regra 5 — conversão saudável, margem comprimida
  if (
    metrics.conversionRate != null && metrics.conversionRate >= benchmarks.conversionRate.min &&
    economics.contributionMargin != null && economics.contributionMargin < MIN_CONTRIBUTION_MARGIN
  ) {
    return {
      gargalo: 'RENTABILIDADE',
      regraDisparada: `Margem de contribuição de ${(economics.contributionMargin * 100).toFixed(1)}% abaixo do mínimo saudável (${(MIN_CONTRIBUTION_MARGIN * 100).toFixed(0)}%)`,
      causaProvavelSugerida: 'Volume de vendas é bom, mas a margem está comprimida por custo do produto, frete ou investimento em anúncios',
      ganhoPotencialEstimado: calculatePotentialGain({
        benchmark: MIN_CONTRIBUTION_MARGIN,
        current: economics.contributionMargin,
        previousStageVolume: metrics.orders,
        avgTicket,
        marginRate: 1,
      }),
    }
  }

  return {
    gargalo: 'SAUDAVEL',
    regraDisparada: 'Nenhuma métrica fora dos benchmarks do nicho',
    causaProvavelSugerida: 'Funil dentro dos parâmetros saudáveis para o nicho — sem gargalo crítico identificado',
    ganhoPotencialEstimado: 0,
  }
}
