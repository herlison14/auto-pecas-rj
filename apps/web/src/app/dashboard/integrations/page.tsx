'use client'

import Link from 'next/link'
import { Activity } from 'lucide-react'
import { useStores } from '@/hooks/use-stores'
import { MarketplaceCard } from '@/components/integrations/marketplace-card'
import { Button } from '@/components/ui/button'

const AVAILABLE_MARKETPLACES = [
  { id: 'MERCADO_LIVRE', name: 'Mercado Livre', slug: 'mercadolivre', emoji: '🟡', color: '#FFE600' },
  { id: 'SHOPEE',        name: 'Shopee',        slug: 'shopee',       emoji: '🟠', color: '#FF5722' },
  { id: 'AMAZON',        name: 'Amazon',        slug: 'amazon',       emoji: '🔵', color: '#FF9900' },
  { id: 'MAGALU',        name: 'Magazine Luiza', slug: 'magalu',      emoji: '🟢', color: '#0066CC' },
  { id: 'AMERICANAS',    name: 'Americanas',    slug: 'americanas',   emoji: '🔴', color: '#CC0000' },
  { id: 'SHEIN',         name: 'Shein',         slug: 'shein',        emoji: '⚫', color: '#111111' },
  { id: 'TIKTOK_SHOP',   name: 'TikTok Shop',   slug: 'tiktokshop',   emoji: '🎵', color: '#FE2C55' },
]

export default function IntegrationsPage() {
  const { data: stores } = useStores()

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Conecte seus marketplaces e gerencie tudo em um só lugar</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/integrations/health">
            <Activity className="h-4 w-4" /> Status de conexão
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AVAILABLE_MARKETPLACES.map((mp) => {
          const connected = stores?.filter((s) => s.marketplace === mp.id) ?? []
          return <MarketplaceCard key={mp.id} marketplace={mp} connectedStores={connected} />
        })}
      </div>
    </div>
  )
}
