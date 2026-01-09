'use client'
import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertCircle } from 'lucide-react'
import type { Issue } from '@/lib/issues'

type Props = {
  issue: Issue | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const priorityColors = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
}

const categoryIcons = {
  bug: '🐛',
  feature: '✨',
  task: '📋',
  discussion: '💬',
}

const IssueDialog = ({ issue, open, onOpenChange }: Props) => {
  if (!issue) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl">{categoryIcons[issue.category]}</span>
            <span className="text-lg">{issue.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">

          <div className="flex flex-wrap items-center gap-3">
            <Badge
              className={`${priorityColors[issue.priority]} capitalize`}
            >
              {issue.priority} Priority
            </Badge>

            <Badge variant="outline" className="capitalize">
              {issue.category}
            </Badge>

            {issue.timestamp && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {issue.timestamp}
              </div>
            )}
          </div>

     
          <div className="rounded-lg bg-muted/30 p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4" />
              Description
            </h3>
            <p className="leading-7 text-sm">{issue.description}</p>
          </div>

          {issue.assignedTo && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Assigned To</h3>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-medium">
                  {issue.assignedTo[0]?.toUpperCase() || '?'}
                </div>
                <span className="text-sm">{issue.assignedTo}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default IssueDialog