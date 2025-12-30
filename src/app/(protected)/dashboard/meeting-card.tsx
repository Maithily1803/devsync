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
    maxSize: 100 * 1024 * 1024, // 100MB max
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (!file) {
        toast.error('No file selected')
        return
      }

      console.log('📁 File selected:', {
        name: file.name,
        size: file.size,
        type: file.type,
      })

      setUploading(true)
      const uploadToast = toast.loading('Uploading audio file...')

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('projectId', project.id)

        console.log('📤 Uploading to /api/audio-upload...')

        const response = await fetch('/api/audio-upload', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()
        console.log('📥 Upload response:', data)

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed')
        }

        toast.success(data.message || 'Upload successful! Processing...', {
          id: uploadToast,
        })

        console.log('✅ Upload successful, navigating to meeting:', data.meeting.id)

        // Navigate to the meeting page
        setTimeout(() => {
          router.push(`/meeting/${data.meeting.id}`)
        }, 500)
      } catch (error) {
        console.error('❌ Upload error:', error)
        toast.error(
          error instanceof Error ? error.message : 'Failed to upload audio',
          { id: uploadToast }
        )
      } finally {
        setUploading(false)
      }
    },
    onDropRejected: (rejectedFiles) => {
      const rejection = rejectedFiles[0]
      if (rejection?.errors[0]?.code === 'file-too-large') {
        toast.error('File is too large. Maximum size is 100MB.')
      } else if (rejection?.errors[0]?.code === 'file-invalid-type') {
        toast.error('Invalid file type. Please upload audio or video files.')
      } else {
        toast.error('File rejected. Please try again.')
      }
    },
  })

  return (
    <Card className="col-span-1 sm:col-span-2 p-6 sm:p-10">
      <div
        {...getRootProps()}
        className="flex flex-col items-center text-center"
      >
        <Presentation className="h-8 w-8 sm:h-10 sm:w-10 animate-bounce" />

        <h3 className="mt-2 text-base sm:text-lg font-semibold">
          Create a new meeting
        </h3>

        <p className="mt-1 text-sm sm:text-base text-gray-500">
          Analyse your meeting with Devsync.
          <br /> Powered by AI.
        </p>

        <div className="mt-6 w-full flex justify-center">
          <Button
            type="button"
            size="lg"
            onClick={open}
            disabled={uploading}
            className="
              w-full sm:w-auto
              cursor-pointer
              text-sm sm:text-base
              font-semibold
              transition-all duration-200
              hover:bg-primary/90
              hover:scale-[1.03]
              active:scale-[0.97]
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                Upload Meeting
              </>
            )}
          </Button>
        </div>

        {/* Hidden input */}
        <input {...getInputProps()} />
      </div>
    </Card>
  )
}

export default MeetingCard

