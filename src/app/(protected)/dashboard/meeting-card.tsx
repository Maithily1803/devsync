'use client'
import React from 'react'
import { Card } from '@/components/ui/card'
import { useDropzone } from 'react-dropzone'
import { Presentation, Upload } from 'lucide-react'
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

  const { getRootProps, getInputProps, open } = useDropzone({
    accept: {
      'video/*': ['.mp4', '.mov', '.mkv'],
      'audio/*': ['.mp3', '.wav'],
    },
    multiple: false,
    noClick: true,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (!file) return
      toast.success('Uploaded!')
      router.push('/meeting')
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
            className="
              w-full sm:w-auto
              cursor-pointer
              text-sm sm:text-base
              font-semibold
              transition-all duration-200
              hover:bg-primary/90
              hover:scale-[1.03]
              active:scale-[0.97]
            "
          >
            <Upload className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
            Upload Meeting
          </Button>
        </div>

        {/* Hidden input */}
        <input {...getInputProps()} />
      </div>
    </Card>
  )
}

export default MeetingCard

