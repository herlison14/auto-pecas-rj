import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

// Modelo padrão pra análise. Haiku é barato e suficiente pra extração de emails / análise de freshness.
// Usar Sonnet só pra tarefas que exijam raciocínio mais profundo.
export const CLAUDE_HAIKU = 'claude-haiku-4-5-20251001';
export const CLAUDE_SONNET = 'claude-sonnet-4-6';

let _client: Anthropic | null = null;

export function getClaude() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Extrai emails de um HTML/texto de site.
 * Roda no server. Faz fetch direto (sem CORS proxy) com timeout.
 */
export async function extractEmailsFromSite(
  websiteUrl: string,
): Promise<{ emails: string[]; htmlAvailable: boolean }> {
  let rawHtml = '';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(websiteUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; LeadRadarBot/1.0; +https://lead-radar.vercel.app)',
        },
        redirect: 'follow',
      });
      rawHtml = await resp.text();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return { emails: [], htmlAvailable: false };
  }

  // Strip HTML pra reduzir tokens
  const text = rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);

  if (!text) return { emails: [], htmlAvailable: false };

  const claude = getClaude();
  const msg = await claude.messages.create({
    model: CLAUDE_HAIKU,
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Analise o conteúdo deste site e extraia todos os endereços de email encontrados (institucionais, vendas, contato, suporte). Ignore emails fakes/placeholder como "seu@email.com".

Site: ${websiteUrl}
Conteúdo:
${text}

Responda APENAS com JSON neste formato: {"emails": ["email1@dominio.com", "email2@dominio.com"]}
Se não houver emails reais, responda {"emails": []}.
Nada além do JSON.`,
      },
    ],
  });

  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { emails: [], htmlAvailable: true };

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { emails: unknown };
    const emails = Array.isArray(parsed.emails)
      ? parsed.emails.filter(
          (e): e is string => typeof e === 'string' && /@.+\..+/.test(e),
        )
      : [];
    return { emails: [...new Set(emails)], htmlAvailable: true };
  } catch {
    return { emails: [], htmlAvailable: true };
  }
}
