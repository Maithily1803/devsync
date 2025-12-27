'use client'
import { DialogHeader, Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import useProject from '@/hooks/use-project'
import React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const InviteButton = () => {
  const { projectId } = useProject()
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Members</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-500">
            Ask them to copy and paste this link.
          </p>

          <Input
            className="mt-4 text-sm sm:text-base"
            readOnly
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/join/${projectId}`
              )
              toast.success('Copied to clipboard')
            }}
            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/join/${projectId}`}
          />
        </DialogContent>
      </Dialog>

      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="
          w-full sm:w-auto
          cursor-pointer
          text-sm sm:text-sm
          font-semibold
          transition-all duration-200
          hover:bg-primary/90
          hover:scale-[1.03]
          active:scale-[0.97]
        "
      >
        Invite Members
      </Button>
    </>
  )
}

export default InviteButton

