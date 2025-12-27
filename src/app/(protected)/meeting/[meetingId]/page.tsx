// src/app/(protected)/meeting/[meetingId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Presentation, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Meeting = {
  id: string;
  name: string;
  audioUrl: string;
  transcript: string | null;
  status: string;
  assemblyaiId: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function MeetingPage() {
  const params = useParams();
  const meetingId = params.meetingId as string;
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMeeting = async () => {
    try {
      const res = await fetch(`/api/meeting-detail/${meetingId}`);
      if (!res.ok) {
        console.error("Failed to fetch meeting");
        return;
      }
      const data = await res.json();
      setMeeting(data.meeting);
    } catch (error) {
      console.error("Error fetching meeting:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMeeting();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMeeting();

    // ✅ Auto-refresh every 3 seconds if still processing
    const interval = setInterval(() => {
      if (meeting?.status === "processing") {
        fetchMeeting();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [meetingId, meeting?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Meeting not found</h1>
          <p className="text-gray-600 mt-2">
            The meeting you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
  <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
    {/* ================= Header ================= */}
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-muted rounded-full">
          <Presentation className="h-6 w-6 text-muted-foreground" />
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            Meeting · {new Date(meeting.createdAt).toLocaleString()}
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold">
            {meeting.name}
          </h1>
        </div>
      </div>

      {meeting.status === "processing" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-fit"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${
              refreshing ? "animate-spin" : ""
            }`}
          />
          Refresh
        </Button>
      )}
    </header>

    {/* ================= Overview Card ================= */}
    <section className="rounded-lg border bg-white p-5 shadow-sm space-y-5">
      {/* Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Meeting Overview</h2>

        {meeting.status === "processing" && (
          <span className="text-xs font-medium text-yellow-600">
            Processing…
          </span>
        )}
        {meeting.status === "completed" && (
          <span className="text-xs font-medium text-green-600">
            Completed ✓
          </span>
        )}
        {meeting.status === "failed" && (
          <span className="text-xs font-medium text-red-600">
            Failed
          </span>
        )}
      </div>

      {/* Audio */}
      {meeting.audioUrl && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Audio
          </p>
          <audio controls className="w-full">
            <source src={meeting.audioUrl} type="audio/mpeg" />
            <source src={meeting.audioUrl} type="audio/wav" />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Transcript */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Transcript
        </p>

        {meeting.status === "processing" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing speech-to-text… This may take a few minutes.
          </div>
        )}

        {meeting.status === "completed" && meeting.transcript && (
          <div
            className="
              prose
              max-w-none
              leading-7
              text-sm sm:text-base
              rounded-lg
              bg-muted/30
              p-4 sm:p-5
              max-h-[45vh]
              overflow-y-auto
            "
          >
            {meeting.transcript}
          </div>
        )}

        {meeting.status === "completed" && !meeting.transcript && (
          <p className="text-sm text-muted-foreground">
            Transcript completed but text is empty.
          </p>
        )}

        {meeting.status === "failed" && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">
            <p className="font-medium mb-1">
              ❌ Failed to generate transcript
            </p>
            Please try uploading the file again.
          </div>
        )}
      </div>
    </section>

    {/* ================= Debug (Dev only, collapsed) ================= */}
    {process.env.NODE_ENV === "development" && (
      <details className="rounded-lg border bg-muted/30 p-4 text-xs">
        <summary className="cursor-pointer font-medium text-muted-foreground">
          More details
        </summary>
        <pre className="mt-3 overflow-auto">
          {JSON.stringify(meeting, null, 2)}
        </pre>
      </details>
    )}
  </div>
);
}