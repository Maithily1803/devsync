// src/app/page.tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/server/db'

export default async function Home() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  //if user has any projects
  const projects = await db.project.findMany({
    where: {
      UserToProjects: {
        some: { userId },
      },
      deletedAt: null,
    },
    take: 1, //at least one exists
  })

  //redirect to create page if none
  if (projects.length === 0) {
    redirect('/create')
  }

  //redirect to dashboard if projects exist
  redirect('/dashboard')
}