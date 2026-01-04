// src/app/sync-user/page.tsx
import { db } from '@/server/db'
import { auth, clerkClient} from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'

const FREE_CREDITS_FOR_NEW_USERS = 100; // ✅ Free credits for new signups

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

    await db.user.upsert({
        where: {
            emailAddress:user.emailAddresses[0]?.emailAddress??""
        },
        update: {
            imageUrl: user.imageUrl,
            firstName: user.firstName,
            lastName: user.lastName,
            // ✅ Don't update credits for existing users
        },
        create: {
            id: userId,
            emailAddress:user.emailAddresses[0]?.emailAddress??"",
            imageUrl: user.imageUrl,
            firstName: user.firstName,
            lastName: user.lastName,
            credits: FREE_CREDITS_FOR_NEW_USERS, // ✅ New users get 100 free credits
        },
    })
    return redirect('/dashboard')

}

export default SyncUser