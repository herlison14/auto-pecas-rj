'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { CircleHelp, X, ListChecks, Lightbulb, Info } from 'lucide-react'

interface HelpEntry {
  title: string
  intro: string
  steps: string[]
  tips?: string[]
}

// Conteúdo de ajuda por rota. A correspondência usa o prefixo mais longo,
// então /dashboard/products/import herda a ajuda de /dashboard/products
// a menos que tenha entrada própria.
const HELP: Record<string, HelpEntry> = {
  '/dashboard': {
    title: 'Dashboard',
    intro: 'Visão geral do seu negócio: receita, pedidos, ticket médio e alertas de estoque em um só lugar.',
    steps: [
      'Use os botões 7d / 30d / 90d no topo para mudar o período analisado.',
      'Os 4 cartões mostram receita do período, ticket médio, pedidos pendentes e produtos com estoque crítico.',
      'O gráfico "Receita diária" mostra a evolução das vendas; passe o mouse para ver o valor de cada dia.',
      '"Receita por canal" compara o desempenho de cada marketplace conectado.',
      '"Top 5 produtos" lista os mais vendidos — clique em "Ver todos" para o catálogo completo.',
      'Em "Ações rápidas", clique em qualquer atalho para ir direto à área correspondente.',
    ],
    tips: ['Conecte um marketplace em Integrações para os dados começarem a aparecer automaticamente.'],
  },
  '/dashboard/orders': {
    title: 'Pedidos',
    intro: 'Central de pedidos de todos os marketplaces conectados, em um fluxo único de processamento.',
    steps: [
      'Os pedidos são importados automaticamente dos marketplaces conectados.',
      'Use os filtros de status (pendente, pago, enviado, entregue, cancelado) para organizar a fila.',
      'Clique em um pedido para ver os detalhes: itens, comprador, endereço e valores.',
      'Atualize o status do pedido conforme avança no processamento (separação → envio).',
      'Quando um pedido é confirmado e pago, a NF-e é emitida automaticamente (configure os dados fiscais em Configurações → Fiscal).',
      'Assim que a nota é autorizada, a DANFE entra na fila de impressão automática — o diálogo de impressão abre sozinho com a página do sistema aberta.',
      'Na tela de detalhe do pedido você também pode imprimir a DANFE manualmente ou baixar o PDF.',
    ],
    tips: [
      'Pedidos pendentes aparecem como alerta no Dashboard para você não perder prazos.',
      'A impressão funciona com qualquer impressora instalada no computador: térmica, jato de tinta ou laser — quem cuida do hardware é o driver do sistema.',
    ],
  },
  '/dashboard/inventory': {
    title: 'Estoque',
    intro: 'Controle de estoque em tempo real com sincronização entre todos os canais de venda.',
    steps: [
      'Cada produto mostra a quantidade disponível, reservada e o estoque mínimo configurado.',
      'Ajuste quantidades manualmente clicando no produto (entrada, saída ou correção).',
      'Configure o estoque mínimo por produto para receber alertas de reposição.',
      'Produtos abaixo do mínimo aparecem destacados e geram alerta no Dashboard.',
      'Quando uma venda acontece em um canal, o estoque é descontado e sincronizado nos demais.',
    ],
    tips: ['Defina estoques mínimos realistas: o alerta dá tempo de repor antes de esgotar.'],
  },
  '/dashboard/products': {
    title: 'Produtos',
    intro: 'Seu catálogo central (PIM): cadastre uma vez e publique em todos os marketplaces.',
    steps: [
      'Clique em "Novo Produto" para cadastrar manualmente (SKU, nome, marca, NCM, dimensões, fotos).',
      'Ou clique em "Importar" para subir vários produtos de uma vez via planilha CSV/XLSX.',
      'Na importação, baixe o modelo de planilha, preencha uma linha por produto e faça o upload.',
      'Use a busca por nome ou SKU para localizar produtos rapidamente.',
      'Clique em um produto para editar dados, fotos e ver em quais canais ele está publicado.',
    ],
    tips: ['O SKU é o identificador único — use um padrão consistente (ex: CAT-MARCA-001).'],
  },
  '/dashboard/products/import': {
    title: 'Importar Produtos',
    intro: 'Importação em massa do seu catálogo via planilha CSV ou Excel (XLSX).',
    steps: [
      'Clique em "Baixar modelo CSV" para obter a planilha com as colunas corretas.',
      'Preencha uma linha por produto. Colunas obrigatórias: sku e name (nome).',
      'Colunas opcionais: descrição, marca, NCM, EAN/GTIN, peso (kg), dimensões (cm), URLs de imagens e estoque inicial.',
      'Salve o arquivo e arraste (ou clique) na área de upload.',
      'Revise a pré-visualização: confira se as colunas foram reconhecidas corretamente.',
      'Clique em "Confirmar importação". Produtos com SKU existente são atualizados, novos são criados.',
    ],
    tips: [
      'Limite de 2.000 produtos / 10 MB por arquivo. Divida planilhas maiores.',
      'Se usar Excel em português, salve como "CSV UTF-8" para evitar problemas com acentos.',
    ],
  },
  '/dashboard/catalog': {
    title: 'Catálogo',
    intro: 'Visão consolidada do catálogo com as divergências entre o SellSync e os marketplaces.',
    steps: [
      'A lista mostra cada produto e seu status de sincronização em cada canal.',
      'Divergências de preço ou estoque entre canais aparecem destacadas.',
      'Use a sincronização para alinhar os dados do marketplace com o catálogo central.',
    ],
  },
  '/dashboard/listings': {
    title: 'Anúncios',
    intro: 'Gerencie os anúncios publicados em cada marketplace a partir de um único painel.',
    steps: [
      'Cada linha é um anúncio em um canal, vinculado a um produto do seu catálogo.',
      'Verifique status (ativo, pausado, encerrado), preço e estoque publicados.',
      'Vincule anúncios já existentes nos marketplaces aos produtos do catálogo para sincronizar.',
      'Pause ou reative anúncios sem sair do SellSync.',
    ],
  },
  '/dashboard/integrations': {
    title: 'Integrações',
    intro: 'Conecte suas contas dos marketplaces para sincronizar pedidos, estoque e anúncios.',
    steps: [
      'Clique em "Conectar" no marketplace desejado.',
      'Mercado Livre e Shopee: você será redirecionado para fazer login na sua conta do marketplace e autorizar o SellSync (OAuth). Requer credenciais de app configuradas no servidor.',
      'Se a conexão automática não estiver disponível, use a conexão manual: informe nome da loja, ID da loja e o token de acesso gerado no painel de desenvolvedor do marketplace.',
      'Após conectar, a loja aparece no cartão com status verde e a sincronização inicia automaticamente.',
      'Use "Status de conexão" para verificar a saúde de cada integração (tokens expirados, erros).',
      'Para desconectar uma loja, clique em "Desconectar" no cartão dela.',
    ],
    tips: [
      'Mercado Livre: crie um app em developers.mercadolivre.com.br para obter as credenciais.',
      'Shopee: registre-se em open.shopee.com como parceiro para obter Partner ID e Key.',
    ],
  },
  '/dashboard/pricing': {
    title: 'Precificação',
    intro: 'Calcule o preço de venda ideal considerando custos, comissões do marketplace, frete e margem.',
    steps: [
      'Informe o custo do produto e a margem de lucro desejada.',
      'O sistema calcula o preço sugerido considerando a comissão de cada marketplace.',
      'Compare a rentabilidade do mesmo produto em diferentes canais.',
      'Aplique o preço calculado diretamente nos anúncios.',
    ],
    tips: ['Lembre de incluir custos de embalagem e frete subsidiado no custo total.'],
  },
  '/dashboard/repricing': {
    title: 'Reprecificação',
    intro: 'Regras automáticas de ajuste de preço para manter competitividade sem trabalho manual.',
    steps: [
      'Crie uma regra definindo o gatilho (ex: concorrente baixou o preço) e o limite mínimo/máximo.',
      'Defina os produtos ou categorias em que a regra se aplica.',
      'Ative a regra — os preços passam a ser ajustados automaticamente dentro dos limites.',
      'Acompanhe o histórico de alterações para auditar o comportamento das regras.',
    ],
    tips: ['Sempre defina um preço mínimo que preserve sua margem — nunca deixe a regra sem piso.'],
  },
  '/dashboard/suppliers': {
    title: 'Fornecedores',
    intro: 'Cadastro de fornecedores e vínculo com produtos para controle de reposição e custos.',
    steps: [
      'Cadastre o fornecedor com dados de contato e condições comerciais.',
      'Vincule produtos ao fornecedor com custo e prazo de entrega.',
      'Use essas informações na hora de repor estoque de produtos em alerta.',
    ],
  },
  '/dashboard/customers': {
    title: 'Clientes',
    intro: 'Base unificada de clientes de todos os canais, com histórico de compras.',
    steps: [
      'Os clientes são criados automaticamente a partir dos pedidos importados.',
      'Clique em um cliente para ver o histórico completo de pedidos e o valor total gasto.',
      'Use a busca por nome, e-mail ou documento para localizar um cliente.',
    ],
  },
  '/dashboard/financial': {
    title: 'Financeiro',
    intro: 'Fluxo de caixa consolidado: receitas dos marketplaces, taxas, comissões e despesas.',
    steps: [
      'As transações de venda entram automaticamente a partir dos pedidos.',
      'Registre despesas manuais (embalagem, anúncios, operação) para ter a visão completa.',
      'Acompanhe o resultado por período e por canal de venda.',
      'Compare o valor bruto da venda com o líquido após comissões e taxas.',
    ],
  },
  '/dashboard/returns': {
    title: 'Devoluções',
    intro: 'Gestão centralizada de devoluções e reembolsos de todos os canais.',
    steps: [
      'Devoluções abertas nos marketplaces aparecem aqui automaticamente.',
      'Acompanhe o status: solicitada → em trânsito → recebida → reembolsada.',
      'Ao receber o produto de volta, registre se ele retorna ao estoque vendável.',
      'Monitore a taxa de devolução por produto para identificar problemas recorrentes.',
    ],
  },
  '/dashboard/performance': {
    title: 'Performance',
    intro: 'Indicadores de desempenho da operação: conversão, tempo de envio, reputação.',
    steps: [
      'Acompanhe os KPIs de cada canal de venda no período selecionado.',
      'Compare a evolução mês a mês para identificar tendências.',
      'Use os indicadores de envio para proteger sua reputação nos marketplaces.',
    ],
  },
  '/dashboard/reports': {
    title: 'Relatórios',
    intro: 'Relatórios detalhados de vendas, produtos e canais, com exportação.',
    steps: [
      'Escolha o tipo de relatório e o período desejado.',
      'Visualize os gráficos e tabelas na tela.',
      'Exporte em CSV/Excel para analisar fora do sistema ou enviar ao contador.',
    ],
  },
  '/dashboard/audit': {
    title: 'Auditoria',
    intro: 'Registro de todas as ações realizadas no sistema: quem fez o quê e quando.',
    steps: [
      'Cada ação relevante (criação, edição, exclusão, login) gera um registro.',
      'Filtre por usuário, tipo de ação ou período para investigar qualquer alteração.',
      'Use a auditoria para rastrear alterações de preço e estoque inesperadas.',
    ],
  },
  '/dashboard/settings': {
    title: 'Configurações',
    intro: 'Configurações da conta: dados da empresa, equipe, segurança, e-mail e plano.',
    steps: [
      'Em "Empresa", atualize nome e dados fiscais (CNPJ, regime tributário) usados na NF-e.',
      'Em "Fiscal (NF-e)", configure CNPJ, razão social e ligue/desligue a emissão e a impressão automáticas da nota.',
      'Em "Equipe", convide usuários e defina permissões (Admin, Gerente, Operador).',
      'Em "Segurança", ative a autenticação em dois fatores (2FA) para proteger a conta.',
      'Em "Plano", veja seu plano atual e faça upgrade quando precisar de mais canais.',
    ],
    tips: ['Recomendamos ativar o 2FA para todos os usuários com acesso administrativo.'],
  },
  '/dashboard/notifications': {
    title: 'Notificações',
    intro: 'Central de avisos do sistema: pedidos novos, estoque crítico, erros de sincronização.',
    steps: [
      'As notificações chegam em tempo real no sininho do topo.',
      'Clique em uma notificação para ir direto à área relacionada.',
      'Marque como lidas as que já tratou para manter a central organizada.',
    ],
  },
}

function findHelp(pathname: string): HelpEntry | null {
  const keys = Object.keys(HELP).sort((a, b) => b.length - a.length)
  const key = keys.find((k) => pathname === k || pathname.startsWith(k + '/')) ?? (pathname.startsWith('/dashboard') ? '/dashboard' : null)
  return key ? HELP[key] : null
}

export function PageHelp() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const help = findHelp(pathname)

  if (!help) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Ajuda — ${help.title}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
        style={{ color: '#94a3b8' }}
      >
        <CircleHelp className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} />
          <aside
            className="relative h-full w-full max-w-md overflow-y-auto p-6 animate-slide-in-left"
            style={{ background: '#0b0b14', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#6366f1' }}>Ajuda</p>
                <h2 className="text-lg font-bold mt-0.5" style={{ color: '#f1f5f9' }}>{help.title}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-1" style={{ color: '#64748b' }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="flex gap-2.5 rounded-xl p-3.5 mb-5 text-sm leading-relaxed"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', color: '#c7d2fe' }}
            >
              <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#818cf8' }} />
              {help.intro}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="h-4 w-4" style={{ color: '#818cf8' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>Passo a passo</h3>
            </div>
            <ol className="space-y-2.5 mb-6">
              {help.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold mt-0.5"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
                  >
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            {help.tips && help.tips.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4" style={{ color: '#fbbf24' }} />
                  <h3 className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>Dicas</h3>
                </div>
                <ul className="space-y-2">
                  {help.tips.map((tip, i) => (
                    <li
                      key={i}
                      className="rounded-lg px-3.5 py-2.5 text-sm leading-relaxed"
                      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', color: '#fde68a' }}
                    >
                      {tip}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
