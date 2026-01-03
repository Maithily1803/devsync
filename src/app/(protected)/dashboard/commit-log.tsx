'use client'

import useProject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import React from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

const CommitLog = () => {
  const { projectId, project } = useProject()

  const { data: commits, isLoading } = api.project.getCommits.useQuery(
    { projectId },
    { enabled: !!projectId, refetchInterval: 30000 } // Auto-refresh every 30s
  )

  if (isLoading && commits === undefined) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-white rounded-md p-4 ring-1 ring-gray-200">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (!isLoading && commits?.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-dashed">
        <p className="text-sm text-gray-500">No commits found yet.</p>
        <p className="text-xs text-gray-400 mt-1">Commits will appear here automatically</p>
      </div>
    )
  }

  return (
    <ul role="list" className="space-y-6">
      {commits?.map((commit, commitIdx) => (
        <li key={commit.id} className="relative flex gap-x-4">
          {/* Timeline line */}
          <div
            className={cn(
              commitIdx === commits.length - 1 ? 'h-6' : '-bottom-6',
              'absolute left-0 top-0 flex w-6 justify-center'
            )}
          >
            <div className="w-px translate-x-1 bg-gray-200" />
          </div>

          {/* Avatar */}
          <img
            src={commit.commitAuthorAvatar}
            alt={commit.commitAuthorName}
            className="relative mt-3 h-8 w-8 flex-none rounded-full bg-gray-50 ring-1 ring-gray-100"
          />

          {/* Content */}
          <div className="flex-auto rounded-md bg-white p-4 ring-1 ring-inset ring-gray-200 hover:ring-gray-300 transition-all">
            {/* Header */}
            <div className="flex justify-between gap-x-4 mb-3">
              <Link
                target="_blank"
                href={`${project?.githubUrl}/commit/${commit.commitHash}`}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span className="font-medium text-gray-900">
                  {commit.commitAuthorName}
                </span>
                <span>committed</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>

              <time
                dateTime={commit.commitDate.toString()}
                className="flex-none text-xs text-gray-500"
              >
                {new Date(commit.commitDate).toLocaleString()}
              </time>
            </div>

            {/* Commit Message - BOLD */}
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-gray-900 leading-snug">
                {commit.commitMessage}
              </h3>
            </div>

            {/* Summary */}
            {commit.summary && commit.summary !== "No significant changes" && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-gray-600 font-sans">
                  {commit.summary}
                </pre>
              </div>
            )}

            {/* Loading state for pending summaries */}
            {(!commit.summary || commit.summary.trim().length === 0) && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="h-3 w-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                  Generating summary...
                </div>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default CommitLog