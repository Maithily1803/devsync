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
    return (
      <div className="space-y-3">
        <p className="text-sm sm:text-base font-semibold text-gray-500">
          Loading commits...
        </p>
        <CommitSkeleton />
      </div>
    )
  }

  if (!isLoading && commits?.length === 0) {
    return <p className="text-sm text-gray-500">No commits found.</p>
  }

  return (
    <ul className="space-y-5 sm:space-y-6">
      {commits?.map((commit, commitIdx) => (
        <li
          key={commit.id}
          className="
            relative
            flex
            flex-col
            sm:flex-row
            gap-3 sm:gap-4
          "
        >
          {/* timeline line */}
          <div
            className={cn(
              commitIdx === commits.length - 1 ? 'h-6' : '-bottom-6',
              'absolute left-0 top-0 flex w-6 justify-center'
            )}
          >
            <div className="hidden sm:block w-px translate-x-1 bg-gray-200" />

          </div>

          {/* avatar */}
          <img
            src={commit.commitAuthorAvatar}
            alt="commit avatar"
            className="
              relative
              mt-1
              w-8 h-8
              sm:w-10 sm:h-10
              rounded-full
              bg-gray-50
              shrink-0
            "
          />

          {/* content */}
          <div
            className="
              flex-1
              rounded-md
              p-3 sm:p-4
              ring-1 ring-inset ring-gray-200
              overflow-hidden
            "
          >
            <Link
              target="_blank"
              href={`${project?.githubUrl}/commit/${commit.commitHash}`}
              className="
                text-xs sm:text-sm
                text-gray-500
                break-words
              "
            >
              <span className="font-semibold text-gray-900 text-sm sm:text-base">
                {commit.commitAuthorName}
              </span>{' '}
              <span className="inline-flex items-center gap-1">
                committed
                <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
              </span>
            </Link>

            <span className="block mt-2 text-sm sm:text-base font-semibold break-words">
              {commit.commitMessage}
            </span>

            {commit.summary && (
              <pre
                className="
                  mt-2
                  whitespace-pre-wrap
                  break-words
                  text-xs sm:text-sm
                  leading-6
                  text-gray-500
                "
              >
                {commit.summary}
              </pre>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default CommitLog

/* ---------------- Skeleton ---------------- */

const CommitSkeleton = () => {
  return (
    <ul className="space-y-5 sm:space-y-6 animate-pulse">
      {Array.from({ length: 3 }).map((_, idx) => (
        <li
          key={idx}
          className="
            relative
            flex
            flex-col
            sm:flex-row
            gap-3 sm:gap-4
          "
        >
          <div className="absolute left-0 top-0 flex w-6 justify-center">
            <div className="w-px h-full bg-gray-200" />
          </div>

          <div className="mt-1 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-200 shrink-0" />

          <div className="flex-1 rounded-md p-3 sm:p-4 ring-1 ring-inset ring-gray-200 space-y-3">
            <div className="h-4 w-32 sm:w-40 rounded bg-gray-200" />
            <div className="h-4 w-48 sm:w-56 rounded bg-gray-200" />
            <div className="h-3 w-full rounded bg-gray-100" />
          </div>
        </li>
      ))}
    </ul>
  )
}


