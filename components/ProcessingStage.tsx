'use client'

import { ReactNode } from 'react'
'use client'

// Iconos simples sin dependencia externa
const CheckCircleIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const XCircleIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ClockIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

interface ProcessingStageProps {
  title: string
  status: 'pending' | 'ok' | 'error'
  children: ReactNode
  message?: string
}

export default function ProcessingStage({
  title,
  status,
  children,
  message,
}: ProcessingStageProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'ok':
        return <CheckCircleIcon className="w-6 h-6 text-green-500" />
      case 'error':
        return <XCircleIcon className="w-6 h-6 text-red-500" />
      case 'pending':
        return <ClockIcon className="w-6 h-6 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'ok':
        return 'border-green-500 bg-green-500/10'
      case 'error':
        return 'border-red-500 bg-red-500/10'
      case 'pending':
        return 'border-gray-600 bg-gray-800/50'
    }
  }

  return (
    <div className={`border-2 rounded-lg p-6 ${getStatusColor()}`}>
      <div className="flex items-center gap-3 mb-4">
        {getStatusIcon()}
        <h3 className="text-xl font-semibold text-gray-200">{title}</h3>
      </div>
      {message && (
        <p className={`mb-4 text-sm ${
          status === 'ok' ? 'text-green-400' : 
          status === 'error' ? 'text-red-400' : 
          'text-gray-400'
        }`}>
          {message}
        </p>
      )}
      <div>{children}</div>
    </div>
  )
}

