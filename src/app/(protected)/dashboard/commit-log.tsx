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
    { enabled: !!projectId }
  )

  if (isLoading && commits === undefined) {
    return <p className="text-sm text-gray-500">Loading commits…</p>
  }

  if (!isLoading && commits?.length === 0) {
    return <p className="text-sm text-gray-500">No commits found.</p>
  }

  return (
    <ul role="list" className="space-y-6">
      {commits?.map((commit, commitIdx) => (
        <li key={commit.id} className="relative flex gap-x-4">
          {/* timeline line */}
          <div
            className={cn(
              commitIdx === commits.length - 1 ? 'h-6' : '-bottom-6',
              'absolute left-0 top-0 flex w-6 justify-center'
            )}
          >
            <div className="w-px translate-x-1 bg-gray-200" />
          </div>

          {/* avatar */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={commit.commitAuthorAvatar}
            alt=""
            className="relative mt-3 h-8 w-8 flex-none rounded-full bg-gray-50"
          />

          {/* content */}
          <div className="flex-auto rounded-md bg-white p-3 ring-1 ring-inset ring-gray-200">
            {/* header */}
            <div className="flex justify-between gap-x-4">
              <Link
                target="_blank"
                href={`${project?.githubUrl}/commit/${commit.commitHash}`}
                className="py-0.5 text-xs leading-5 text-gray-500"
              >
                <span className="font-medium text-gray-900">
                  {commit.commitAuthorName}
                </span>{' '}
                <span className="inline-flex items-center">
                  committed
                  <ExternalLink className="ml-1 h-4 w-4" />
                </span>
              </Link>

              <time
                dateTime={commit.commitDate.toString()}
                className="flex-none py-0.5 text-xs leading-5 text-gray-500"
              >
                {new Date(commit.commitDate).toLocaleString()}
              </time>
            </div>

            {/* MAIN CONTENT */}
            {commit.summary ? (
              <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                {commit.summary}
              </pre>
            ) : (
              <span className="mt-2 block font-semibold text-sm text-gray-900">
                {commit.commitMessage}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default CommitLog


