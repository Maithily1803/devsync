// src/app/sync-user/page.tsx
import { db } from '@/server/db'
import { auth, clerkClient} from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'

const FREE_CREDITS_FOR_NEW_USERS = 100; 

const SyncUser = async () => {
    const {userId} = await auth()
    if (!userId){
        throw new Error('User Not Found')
    }
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    if (!user.emailAddresses[0]?.emailAddress){
        return notFound()
    }

    // check if user exists
    const existingUser = await db.user.findUnique({
        where: { id: userId }
    })

    if (existingUser) {
        // just update profile for existing user
        await db.user.update({
            where: { id: userId },
            data: {
                imageUrl: user.imageUrl,
                firstName: user.firstName,
                lastName: user.lastName,
                credits: {
        increment: 0, 
      },
            },
        })
    } else {
        // create with free credits for new user
        await db.user.create({
            data: {
                id: userId,
                emailAddress: user.emailAddresses[0].emailAddress,
                imageUrl: user.imageUrl,
                firstName: user.firstName,
                lastName: user.lastName,
                credits: FREE_CREDITS_FOR_NEW_USERS,
            },
        })
    }

    return redirect('/dashboard')
}

export default SyncUser