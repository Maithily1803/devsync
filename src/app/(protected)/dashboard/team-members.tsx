'use client'
import useProject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import React from 'react'
import { useUser } from '@clerk/nextjs'

const TeamMembers = () => {
    const { projectId } = useProject()
    const { user } = useUser()
    const { data: members } = api.project.getTeamMembers.useQuery({ projectId})
    return (
        <div className='flex items-center gap-2'>
            {members?.map(member => (
                <img
                    className="w-8 h-8 object-cover rounded-full border"
                    height={32}
                    width={32}
                    src={user?.imageUrl || "/default-avatar.png"}  // Always use currently logged-in user's image
                    alt="User avatar"
                    onError={(e) => (e.currentTarget.src = "/default-avatar.png")}
                  />
            ))}
        </div>
    )
}

export default TeamMembers
