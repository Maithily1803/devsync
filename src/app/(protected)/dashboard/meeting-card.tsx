"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { useDropzone } from "react-dropzone";
import { Presentation, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type MeetingCardProps = {
  project: {
    id: string;
    name: string;
  };
};

const MeetingCard: React.FC<MeetingCardProps> = ({ project }) => {
  const router = useRouter();
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const {
    getRootProps,
    getInputProps,
    open, // 👈 IMPORTANT
  } = useDropzone({
    accept: {
      "video/*": [".mp4", ".mov", ".mkv"],
      "audio/*": [".mp3", ".wav"],
    },
    multiple: false,
    maxSize: 50_000_000,
    noClick: true, // 👈 disable click on entire card

    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setIsUploading(true);
      setProgress(0);

      const progressInterval = setInterval(() => {
        setProgress((p) => (p < 90 ? p + 5 : p));
      }, 300);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", project.id);

        const uploadRes = await fetch("/api/audio-upload", {
          method: "POST",
          body: formData,
        });

        const uploadJson = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadJson?.error || "Upload failed");
        }

        const { audioUrl, meetingId } = uploadJson;

        clearInterval(progressInterval);
        setProgress(100);

        fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioUrl, meetingId }),
        }).catch(console.error);

        setTimeout(() => {
          toast.success("🎉 Uploaded! Transcription is processing.");
          router.push(`/meeting/${meetingId}`);
        }, 500);
      } catch (err) {
        console.error(err);
        clearInterval(progressInterval);
        toast.error("Upload failed.");
        setIsUploading(false);
        setProgress(0);
      }
    },
  });

  return (
    <Card className="col-span-2 p-10">
      {/* Drag-only dropzone */}
      <div
        {...getRootProps()}
        className="flex flex-col items-center justify-center"
      >
        <Presentation className="h-10 w-10 animate-bounce" />

        <h3 className="mt-2 text-sm font-semibold text-gray-900">
          Create a new meeting
        </h3>

        <p className="mt-1 text-center text-sm text-gray-500">
          Analyse your meeting with Devsync.
          <br /> Powered by AI.
        </p>

        <div className="mt-6">
          {/* ✅ ONLY THIS BUTTON is clickable */}
          <Button
            type="button"
            onClick={open}
            className="cursor-pointer"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Meeting
          </Button>
        </div>

        {/* hidden input */}
        <input {...getInputProps()} />
      </div>
    </Card>
  );
};

export default MeetingCard;
