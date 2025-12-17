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
    <div className="max-w-6xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gray-100 rounded-full">
            <Presentation className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm text-gray-500">
              Meeting on {new Date(meeting.createdAt).toLocaleString()}
            </p>
            <h1 className="text-xl font-semibold">{meeting.name}</h1>
          </div>
        </div>
        
        {/* Refresh Button */}
        {meeting.status === "processing" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        )}
      </div>

      {/* Audio Player */}
      {meeting.audioUrl && (
        <div className="bg-white border rounded-md p-5 mb-6">
          <h2 className="font-semibold text-lg mb-3">Audio</h2>
          <audio controls className="w-full">
            <source src={meeting.audioUrl} type="audio/mpeg" />
            <source src={meeting.audioUrl} type="audio/wav" />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Transcript */}
      <div className="bg-white border rounded-md p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Transcript</h2>
          {meeting.status === "processing" && (
            <span className="text-xs text-yellow-600 font-medium">
              Processing...
            </span>
          )}
          {meeting.status === "completed" && (
            <span className="text-xs text-green-600 font-medium">
              Completed
            </span>
          )}
          {meeting.status === "failed" && (
            <span className="text-xs text-red-600 font-medium">Failed</span>
          )}
        </div>

        {meeting.status === "processing" && (
          <div className="flex items-center text-gray-500 gap-2">
            <Loader2 className="animate-spin h-5 w-5" />
            Processing speech-to-text… This may take a few minutes.
          </div>
        )}

        {meeting.status === "completed" && meeting.transcript && (
          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">
              {meeting.transcript}
            </p>
          </div>
        )}

        {meeting.status === "completed" && !meeting.transcript && (
          <p className="text-gray-500 text-sm">
            Transcript completed but text is empty.
          </p>
        )}

        {meeting.status === "failed" && (
          <div className="text-red-600">
            <p className="font-medium mb-2">
              ❌ Failed to generate transcript.
            </p>
            <p className="text-sm">
              Please try uploading the file again or contact support if the
              issue persists.
            </p>
          </div>
        )}
      </div>

      {/* Debug Info (Remove in production) */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-4 p-4 bg-gray-100 rounded text-xs">
          <strong>Debug Info:</strong>
          <pre>{JSON.stringify(meeting, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}