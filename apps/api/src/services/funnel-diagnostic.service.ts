import { prisma, type Marketplace, type FunnelDiagnosticStatus } from '@sellsync/database'
import {
  computeFunnelMetrics,
  computeUnitEconomics,
  applyDiagnosisTree,
  DEFAULT_BENCHMARKS,
} from '../lib/funnel-rules'
import { anthropicEnabled, buildSdePrompt, generateSdeDiagnosis } from '../lib/anthropic'

function toSnapshotInput(snapshot: {
  impressions: number
  clicks: number
  visits: number
  addToCart: number
  orders: number
  revenue: unknown
  adSpend: unknown
  unitCost: unknown
}) {
  return {
    impressions: snapshot.impressions,
    clicks: snapshot.clicks,
    visits: snapshot.visits,
    addToCart: snapshot.addToCart,
    orders: snapshot.orders,
    revenue: Number(snapshot.revenue),
    adSpend: Number(snapshot.adSpend),
    unitCost: snapshot.unitCost != null ? Number(snapshot.unitCost) : null,
  }
}

export async function listSnapshots(
  tenantId: string,
  filters: { productId?: string; marketplace?: Marketplace; page: number; limit: number },
) {
  const where = {
    tenantId,
    ...(filters.productId && { productId: filters.productId }),
    ...(filters.marketplace && { marketplace: filters.marketplace }),
  }

  const [snapshots, total] = await Promise.all([
    prisma.funnelSnapshot.findMany({
      where,
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { periodStart: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.funnelSnapshot.count({ where }),
  ])

  return { snapshots, total, page: filters.page, pages: Math.ceil(total / filters.limit) }
}

export async function listDiagnostics(
  tenantId: string,
  filters: { status?: FunnelDiagnosticStatus; page: number; limit: number },
) {
  const where = {
    tenantId,
    ...(filters.status && { status: filters.status }),
  }

  const [diagnostics, total] = await Promise.all([
    prisma.funnelDiagnostic.findMany({
      where,
      include: {
        snapshot: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.funnelDiagnostic.count({ where }),
  ])

  return { diagnostics, total, page: filters.page, pages: Math.ceil(total / filters.limit) }
}

export async function generateDiagnosis(tenantId: string, snapshotId: string) {
  const snapshot = await prisma.funnelSnapshot.findFirst({
    where: { id: snapshotId, tenantId },
  })
  if (!snapshot) throw new Error('Snapshot de funil não encontrado')

  const priorSnapshots = await prisma.funnelSnapshot.findMany({
    where: {
      tenantId,
      productId: snapshot.productId,
      marketplace: snapshot.marketplace,
      periodStart: { lt: snapshot.periodStart },
    },
    orderBy: { periodStart: 'desc' },
    take: 4,
    select: { impressions: true },
  })

  const historicalAvgImpressions = priorSnapshots.length > 0
    ? priorSnapshots.reduce((sum, s) => sum + s.impressions, 0) / priorSnapshots.length
    : null

  const snapshotInput = toSnapshotInput(snapshot)
  const metrics = computeFunnelMetrics(snapshotInput)
  const economics = computeUnitEconomics(snapshotInput)
  const rule = applyDiagnosisTree(metrics, economics, DEFAULT_BENCHMARKS, historicalAvgImpressions)

  let gargalo: string = rule.gargalo
  let causaProvavel: string = rule.causaProvavelSugerida
  let acoes: Array<{ ordem: number; acao: string; metrica_alvo: string; ganho_estimado_rs: number }> = [
    {
      ordem: 1,
      acao: 'Revisar o gargalo identificado e ajustar a etapa do funil correspondente',
      metrica_alvo: rule.gargalo,
      ganho_estimado_rs: rule.ganhoPotencialEstimado,
    },
  ]
  let alertaEconomico: string | null = economics.contributionMargin != null && economics.contributionMargin < 0.10
    ? `Margem de contribuição em ${(economics.contributionMargin * 100).toFixed(1)}% — abaixo do mínimo saudável.`
    : null

  if (anthropicEnabled) {
    const prompt = buildSdePrompt({
      metrics,
      benchmarks: DEFAULT_BENCHMARKS,
      economics,
      regraDisparada: rule.regraDisparada,
    })
    const aiResult = await generateSdeDiagnosis(prompt)
    gargalo = aiResult.gargalo
    causaProvavel = aiResult.causa_provavel
    acoes = aiResult.acoes
    alertaEconomico = aiResult.alerta_economico
  }

  return prisma.funnelDiagnostic.create({
    data: {
      tenantId,
      snapshotId,
      gargalo,
      causaProvavel,
      alertaEconomico,
      acoes,
    },
  })
}
