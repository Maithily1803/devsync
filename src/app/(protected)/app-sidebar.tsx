'use client'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Bot, CreditCard, LayoutDashboard, Plus, Presentation } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import useProject from '@/hooks/use-project'

const items = [
  { title: 'Dashboard', url: '/dashboard', icons: LayoutDashboard },
  { title: 'Q&A', url: '/qa', icons: Bot },
  { title: 'Meetings', url: '/meeting', icons: Presentation },
  { title: 'Billing', url: '/billing', icons: CreditCard },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { projects, projectId, setProjectId } = useProject()

  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      className="shrink-0"
    >
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="logo" width={45} height={45} />
          <h1 className="text-2xl font-bold text-primary/80">Devsync</h1>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Application */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-base font-semibold">
            Application
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.url}
                      className={cn(
                        pathname === item.url && '!bg-primary !text-white'
                      )}
                    >
                      <item.icons className="w-5 h-5 mr-2" />
                      <span className="text-sm">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Projects */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-base font-semibold">
            Your Projects
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {projects?.map((project) => (
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton asChild>
                    <div
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => setProjectId(project.id)}
                    >
                      <div
                        className={cn(
                          'rounded-sm border size-6 flex items-center justify-center text-base bg-white text-primary',
                          project.id === projectId && 'bg-primary text-white'
                        )}
                      >
                        {project.name[0]}
                      </div>
                      <span className="text-sm">{project.name}</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <div className="h-2" />

              <SidebarMenuItem>
                <Link href="/create">
                  <Button
                    size="lg"
                    variant="outline"
                    className="
                      text-base
                      w-fit
                      cursor-pointer
                      transition-all duration-200
                      hover:bg-primary/10
                      hover:scale-[1.03]
                      active:scale-[0.97]
                    "
                  >
                    <Plus    />
                    Create Project
                  </Button>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
