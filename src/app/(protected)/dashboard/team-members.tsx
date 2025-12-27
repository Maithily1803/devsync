'use client'
import useProject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import React from 'react'
import { useUser } from '@clerk/nextjs'

const MAX_VISIBLE_MEMBERS = 5

const TeamMembers = () => {
  const { projectId } = useProject()
  const { user } = useUser()
  const { data: members } = api.project.getTeamMembers.useQuery({ projectId })

  if (!members || members.length === 0) return null

  const visibleMembers = members.slice(0, MAX_VISIBLE_MEMBERS)
  const remainingCount = members.length - MAX_VISIBLE_MEMBERS

  return (
    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
      {visibleMembers.map((_, idx) => (
        <img
          key={idx}
          className="
            w-8 h-8
            sm:w-9 sm:h-9
            object-cover
            rounded-full
            border
            shrink-0
          "
          src={user?.imageUrl || '/default-avatar.png'}
          alt="User avatar"
          onError={(e) => (e.currentTarget.src = '/default-avatar.png')}
        />
      ))}

      {remainingCount > 0 && (
        <div
          className="
            w-8 h-8
            sm:w-9 sm:h-9
            flex items-center justify-center
            rounded-full
            border
            text-xs sm:text-sm
            font-medium
            bg-muted
            text-muted-foreground
            shrink-0
          "
        >
          +{remainingCount}
        </div>
      )}
    </div>
  )
}

export default TeamMembers

