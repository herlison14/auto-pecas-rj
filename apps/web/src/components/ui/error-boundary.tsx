'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    // Reporta para o Sentry (no-op se SENTRY_DSN não estiver configurado)
    import('@sentry/nextjs').then(({ captureException }) => {
      captureException(error, { extra: { componentStack: info.componentStack } })
    }).catch(() => {})
  }

  reset = () => this.setState({ hasError: false, message: '' })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Algo deu errado</p>
            <p className="text-sm text-muted-foreground mt-1">{this.state.message || 'Erro inesperado ao renderizar este componente.'}</p>
          </div>
          <Button variant="outline" size="sm" onClick={this.reset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
