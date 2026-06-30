import { describe, it, expect } from 'vitest'
import {
  computeFunnelMetrics,
  computeUnitEconomics,
  applyDiagnosisTree,
  calculatePotentialGain,
  DEFAULT_BENCHMARKS,
  type FunnelSnapshotInput,
} from '../lib/funnel-rules'

const base: FunnelSnapshotInput = {
  impressions: 10_000,
  clicks: 250,       // CTR 2.5% — dentro do benchmark
  visits: 250,
  addToCart: 20,      // ATC rate 8% — dentro do benchmark
  orders: 8,           // conversion 3.2% — dentro do benchmark
  revenue: 4000,
  adSpend: 400,
  unitCost: 200,
}

describe('computeFunnelMetrics', () => {
  it('calcula CTR, ATC rate, conversão e abandono corretamente', () => {
    const m = computeFunnelMetrics(base)
    expect(m.ctr).toBeCloseTo(0.025)
    expect(m.atcRate).toBeCloseTo(0.08)
    expect(m.conversionRate).toBeCloseTo(0.032)
    expect(m.abandonmentRate).toBeCloseTo((20 - 8) / 20)
  })

  it('retorna null quando o denominador é zero (evita divisão por zero)', () => {
    const m = computeFunnelMetrics({ ...base, impressions: 0, visits: 0, addToCart: 0 })
    expect(m.ctr).toBeNull()
    expect(m.atcRate).toBeNull()
    expect(m.conversionRate).toBeNull()
    expect(m.abandonmentRate).toBeNull()
  })
})

describe('computeUnitEconomics', () => {
  it('calcula ticket médio, ROAS, ACOS e margem de contribuição', () => {
    const e = computeUnitEconomics(base)
    expect(e.avgTicket).toBeCloseTo(500) // 4000 / 8
    expect(e.roas).toBeCloseTo(10)        // 4000 / 400
    expect(e.acos).toBeCloseTo(0.1)        // 400 / 4000
    // margem = (4000 - 200*8 - 400) / 4000 = (4000 - 1600 - 400) / 4000 = 0.5
    expect(e.contributionMargin).toBeCloseTo(0.5)
  })

  it('retorna margem null quando não há custo unitário informado', () => {
    const e = computeUnitEconomics({ ...base, unitCost: null })
    expect(e.contributionMargin).toBeNull()
  })
})

describe('calculatePotentialGain', () => {
  it('aplica a fórmula (benchmark - atual) x volume x ticket x margem', () => {
    const gain = calculatePotentialGain({
      benchmark: 0.03, current: 0.01, previousStageVolume: 1000, avgTicket: 100, marginRate: 0.5,
    })
    expect(gain).toBeCloseTo((0.03 - 0.01) * 1000 * 100 * 0.5)
  })

  it('nunca retorna ganho negativo quando o atual já supera o benchmark', () => {
    const gain = calculatePotentialGain({
      benchmark: 0.01, current: 0.03, previousStageVolume: 1000, avgTicket: 100, marginRate: 0.5,
    })
    expect(gain).toBe(0)
  })
})

describe('applyDiagnosisTree', () => {
  it('diagnostica SAUDAVEL quando todas as métricas estão dentro do benchmark', () => {
    const metrics = computeFunnelMetrics(base)
    const economics = computeUnitEconomics(base)
    const result = applyDiagnosisTree(metrics, economics, DEFAULT_BENCHMARKS, null)
    expect(result.gargalo).toBe('SAUDAVEL')
    expect(result.ganhoPotencialEstimado).toBe(0)
  })

  it('diagnostica ALCANCE quando impressões caem 30%+ vs. média histórica', () => {
    const snapshot = { ...base, impressions: 3000, clicks: 75, visits: 75 }
    const metrics = computeFunnelMetrics(snapshot)
    const economics = computeUnitEconomics(snapshot)
    const result = applyDiagnosisTree(metrics, economics, DEFAULT_BENCHMARKS, 10_000)
    expect(result.gargalo).toBe('ALCANCE')
  })

  it('diagnostica ATRACAO quando CTR está abaixo do benchmark mínimo', () => {
    const snapshot = { ...base, clicks: 50, visits: 50 } // CTR 0.5%
    const metrics = computeFunnelMetrics(snapshot)
    const economics = computeUnitEconomics(snapshot)
    const result = applyDiagnosisTree(metrics, economics, DEFAULT_BENCHMARKS, null)
    expect(result.gargalo).toBe('ATRACAO')
  })

  it('diagnostica CONVERSAO quando CTR é bom mas a conversão está abaixo do benchmark', () => {
    const snapshot = { ...base, orders: 1 } // conversion 0.4%, CTR ainda 2.5%
    const metrics = computeFunnelMetrics(snapshot)
    const economics = computeUnitEconomics(snapshot)
    const result = applyDiagnosisTree(metrics, economics, DEFAULT_BENCHMARKS, null)
    expect(result.gargalo).toBe('CONVERSAO')
  })

  it('diagnostica ABANDONO_CHECKOUT quando ATC é bom mas o abandono é alto', () => {
    const snapshot = { ...base, visits: 500, clicks: 500, addToCart: 50, orders: 30 }
    // CTR 5% (ok), ATC rate 10% (ok), conversion 6% (ok), abandono (50-30)/50=40% -> não dispara regra 4 (precisa > 75%)
    // Ajusta para abandono alto mantendo ATC rate dentro do benchmark
    const adjusted = { ...snapshot, addToCart: 50, orders: 5 } // abandono (50-5)/50=90%
    const metrics = computeFunnelMetrics(adjusted)
    const economics = computeUnitEconomics(adjusted)
    const result = applyDiagnosisTree(metrics, economics, DEFAULT_BENCHMARKS, null)
    expect(result.gargalo).toBe('ABANDONO_CHECKOUT')
  })

  it('diagnostica RENTABILIDADE quando a conversão é boa mas a margem está comprimida', () => {
    const snapshot = { ...base, unitCost: 450 } // margem cai bem abaixo de 10%
    const metrics = computeFunnelMetrics(snapshot)
    const economics = computeUnitEconomics(snapshot)
    const result = applyDiagnosisTree(metrics, economics, DEFAULT_BENCHMARKS, null)
    expect(result.gargalo).toBe('RENTABILIDADE')
  })
})
