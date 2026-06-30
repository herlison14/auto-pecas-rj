import type { ReactNode } from 'react'
import { Sidebar } from '@/components/ui/sidebar'
import { QueryProvider } from '@/components/ui/query-provider'
import { NotificationBell } from '@/components/ui/notification-bell'
import { PageHelp } from '@/components/ui/page-help'
import { AutoPrintAgent } from '@/components/ui/auto-print-agent'
import { OnboardingBanner } from '@/components/ui/onboarding-banner'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { AuthGuard } from '@/components/ui/auth-guard'
import { UserMenu } from '@/components/ui/user-menu'
import { MobileNavHeader } from '@/components/ui/mobile-nav-header'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthGuard>
        {/* Skip navigation — WCAG 2.4.1 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:left-4 focus:top-4 focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          Ir ao conteúdo principal
        </a>

        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />

          <div className="flex flex-1 flex-col overflow-hidden">
            <header
              className="flex h-12 shrink-0 items-center justify-between px-4 gap-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0f0f1a' }}
            >
              {/* Left — menu hambúrguer + título em mobile; breadcrumb placeholder em desktop */}
              <div className="flex items-center gap-2 min-w-0">
                <MobileNavHeader />
                <div className="h-4 w-px hidden lg:block" style={{ background: 'rgba(255,255,255,0.08)' }} />
              </div>

              {/* Right — actions */}
              <div className="flex items-center gap-1 shrink-0">
                <PageHelp />
                <NotificationBell />
                <div className="h-5 w-px mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <UserMenu />
              </div>
            </header>

            <OnboardingBanner />

            <main id="main-content" className="flex-1 overflow-y-auto" style={{ background: '#080810' }}>
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>

            <AutoPrintAgent />
          </div>
        </div>
      </AuthGuard>
    </QueryProvider>
  )
}
