'use client'
import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { useDropzone } from 'react-dropzone'
import { Presentation, Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type MeetingCardProps = {
  project: {
    id: string
    name: string
  }
}

const MeetingCard: React.FC<MeetingCardProps> = ({ project }) => {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)

  const { getRootProps, getInputProps, open } = useDropzone({
    accept: {
      'video/*': ['.mp4', '.mov', '.mkv', '.avi'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac'],
    },
    multiple: false,
    noClick: true,
    maxSize: 100 * 1024 * 1024,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (!file) {
        toast.error('No file selected')
        return
      }

      setUploading(true)
      const uploadToast = toast.loading('Uploading audio file...')

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('projectId', project.id)

        const response = await fetch('/api/audio-upload', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed')
        }

        toast.success(data.message || 'Upload successful!', {
          id: uploadToast,
        })

        setTimeout(() => {
          router.push(`/meeting/${data.meeting.id}`)
        }, 500)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to upload audio',
          { id: uploadToast }
        )
      } finally {
        setUploading(false)
      }
    },
  })

  return (
    <Card className="col-span-1 sm:col-span-2 p-5 sm:p-8">
      <div
        {...getRootProps()}
        className="flex flex-col items-center text-center"
      >

        <Presentation className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />

        <h3 className="mt-2 text-sm sm:text-base font-semibold">
          Create a new meeting
        </h3>

        <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Analyse your meeting with Devsync.
          <br />
          Powered by AI.
        </p>
        <div className="mt-5 w-full flex justify-center">
          <Button
            type="button"
            size="lg"
            onClick={open}
            disabled={uploading}
            className="
              w-full sm:w-auto
              cursor-pointer
              text-sm sm:text-base
              font-medium
              transition-all
              hover:scale-[1.03]
              active:scale-[0.97]
            "
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Upload meeting
              </>
            )}
          </Button>
        </div>
        <input {...getInputProps()} />
      </div>
    </Card>
  )
}

export default MeetingCard
