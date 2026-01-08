'use client'

import React from 'react'
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { UserButton } from '@clerk/nextjs'
import { AppSidebar } from './app-sidebar'
import { Menu } from 'lucide-react'

type Props = {
  children: React.ReactNode
}

const SidebarLayout = ({ children }: Props) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-hidden">
        <AppSidebar />
        <MainContent>{children}</MainContent>
      </div>
    </SidebarProvider>
  )
}

const MainContent = ({ children }: { children: React.ReactNode }) => {
  const { toggleSidebar } = useSidebar()

  return (
    <main
      className="
        flex-1
        min-w-0
        flex flex-col
        px-2 sm:px-0
        overflow-hidden
      "
    >
      {/* top */}
      <div
        className="
          flex items-center gap-2
          border-sidebar-border bg-sidebar border shadow rounded-md
          min-h-[64px]
          px-4 sm:px-6
          py-4
          m-2
        "
      >
        {/* hamburger */}
        <button
          onClick={toggleSidebar}
          className="
            sm:hidden
            p-2
            rounded-md
            hover:bg-muted
            transition
            cursor-pointer
          "
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="ml-auto scale-125 origin-center">
          <UserButton
            appearance={{
              elements: {
                avatarBox:
                  'cursor-pointer hover:ring-2 hover:ring-primary/40 transition',
              },
            }}
          />
        </div>
      </div>

      {/* page */}
      <div
        className="
          flex-1
          m-2
          border-sidebar-border bg-sidebar border shadow rounded-md
          p-3 sm:p-4
          overflow-y-auto
        "
      >
        {children}
      </div>
    </main>
  )
}

export default SidebarLayout

