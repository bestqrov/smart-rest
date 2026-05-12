"use client"

import React from 'react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: any, info: any) {
    // Send to console; backend logger would capture server-side errors
    // Client-side reporting can be added here (Sentry/Logs)
    // Avoid throwing
    // eslint-disable-next-line no-console
    console.error('React ErrorBoundary caught', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-xl text-center">
            <h2 className="text-2xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-gray-600">This section failed to load. Try refreshing the page.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
