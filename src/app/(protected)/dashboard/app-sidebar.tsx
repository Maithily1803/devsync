'use client'

import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Sidebar } from "@/components/ui/sidebar"
import { Bot, CreditCard, LayoutDashboard, Plus, Presentation } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Image from "next/image"


const items = [
    {
        title: "Dashboard",
        url: '/dashboard',
        icons: LayoutDashboard,
    },
    {
        title: "Q&A",
        url: '/qa',
        icons: Bot,
    },
    {
        title: "Meetings",
        url: '/meetings',
        icons: Presentation,
    },
    {
        title: "Billing",
        url: '/billing',
        icons: CreditCard,
    }
]

const projects = [
    {
        name: 'Project 1'
    },
    {
        name: 'Project 2'
    },
    {
        name: 'Project 1'
    }
]

export function AppSidebar(){
    const pathname = usePathname()
    const { open } = useSidebar()
    return (
        <Sidebar collapsible="icon" variant="floating">
                 <SidebarHeader>
                    <div className="flex items-center gap-2">
                        <Image src='/logo.png' alt='logo' width={40} height={40} />
                        {open &&(
                            <h1 className="text-xl font-bold text-primary/80">
                        Devsync
                        </h1>
                        )}
                        
                    </div>
                
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>
                        Application
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                                {items.map(item =>  (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <Link 
                                        href={item.url} 
                                        className={cn(pathname === item.url ? '!bg-primary !text-white': '')}
                                        >
                                            <item.icons className="w-5 h-5 mr-2" />
                                            <span>{item.title}</span>
                                            </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                        
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>
                        Your Projects
                    </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {projects.map(project =>{
                                    return(
                                        <SidebarMenuItem key={project.name}>
                                            <SidebarMenuButton asChild>
                                                <div>
                                                    <div className={cn(
                                                        'rounded-sm border size-6 flex items-center justify-center text-sm bg-white text-primary ',
                                                        {
                                                            'bg-primary text-white': true
                                                            //'bg-primary text-white': project.id === project.id
                                                        }
                                                    )}>
                                                        {project.name[0]}
                                                    </div>
                                                    <span>{project.name}</span>
                                                </div>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )
                                })}
                                <div className="h-2"></div>
                                {open && (
                                    <SidebarMenuItem>
                                    <Link href='/create'>
                                        <Button size='sm' variant={'outline'} className="w-fit">
                                            <Plus />
                                    Create Project
                                </Button>
                                    </Link>
                                </SidebarMenuItem>
                                )}
                                
                                
                            </SidebarMenu>
                        </SidebarGroupContent>
                    
                </SidebarGroup>
            </SidebarContent>

        </Sidebar>
           

            
        
    )
}