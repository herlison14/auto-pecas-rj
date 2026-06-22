import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
// zodOutputFormat exige schemas Zod v4 — o resto do projeto usa Zod v3, então
// usamos o subpath de compatibilidade só para os schemas de output da IA.
import { z } from 'zod/v4'
import type { FunnelBenchmarks, FunnelMetrics, UnitEconomics } from './funnel-rules'

// Ativação opcional — mesmo padrão usado para Sentry/Resend: a feature fica
// inativa até ANTHROPIC_API_KEY ser configurada, sem quebrar o boot da API.
export const anthropicEnabled = !!process.env.ANTHROPIC_API_KEY

const client = anthropicEnabled ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null

const SDE_MODEL = 'claude-sonnet-4-6'

export const SdeActionSchema = z.object({
  ordem: z.number().int().min(1).max(3),
  acao: z.string(),
  metrica_alvo: z.string(),
  ganho_estimado_rs: z.number(),
})

export const SdeResultSchema = z.object({
  gargalo: z.string(),
  causa_provavel: z.string(),
  acoes: z.array(SdeActionSchema).length(3),
  alerta_economico: z.string().nullable(),
})

export type SdeResult = z.infer<typeof SdeResultSchema>

export function buildSdePrompt(params: {
  metrics: FunnelMetrics
  benchmarks: FunnelBenchmarks
  economics: UnitEconomics
  regraDisparada: string
}): string {
  return `Você é um analista de vendas de e-commerce sênior, especialista em marketplaces. Recebeu os dados de funil de UM produto, já normalizados, e os benchmarks do nicho.

Dados do funil (já calculados):
${JSON.stringify(params.metrics, null, 2)}

Benchmarks do nicho:
${JSON.stringify(params.benchmarks, null, 2)}

Economia unitária:
${JSON.stringify(params.economics, null, 2)}

Regra de diagnóstico disparada pelo sistema: ${params.regraDisparada}

Com base nesses dados, identifique o principal gargalo do funil, a causa provável mais plausível, e proponha exatamente 3 ações priorizadas para resolver o gargalo, cada uma com a métrica que ela deve mover e o ganho estimado em reais (R$) se a ação for bem-sucedida. Se a economia unitária indicar risco de prejuízo ou margem muito baixa, inclua um alerta econômico; caso contrário, retorne null nesse campo.`
}

export async function generateSdeDiagnosis(prompt: string): Promise<SdeResult> {
  if (!client) throw new Error('ANTHROPIC_API_KEY não configurada — diagnóstico por IA está desativado')

  try {
    const response = await client.messages.parse({
      model: SDE_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: zodOutputFormat(SdeResultSchema) },
    })

    const result = response.parsed_output
    if (!result) throw new Error('Resposta da IA não pôde ser validada contra o schema esperado')
    return result
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError) throw new Error('Requisição inválida à IA de diagnóstico')
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Chave da API Anthropic inválida')
    if (err instanceof Anthropic.RateLimitError) throw new Error('Limite de requisições à IA atingido — tente novamente em breve')
    if (err instanceof Anthropic.APIError) throw new Error('Erro ao consultar a IA de diagnóstico')
    throw err
  }
}
