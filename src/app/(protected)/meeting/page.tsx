"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useProject from "@/hooks/use-project";
import MeetingCard from "../dashboard/meeting-card";
import { Trash2, Loader2, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Meeting = {
  id: string;
  name: string;
  status: "processing" | "completed" | "failed";
  createdAt: string;
};

const StatusBadge = ({ status }: { status: Meeting["status"] }) => {
  const styles = {
    processing: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
};

const MeetingSkeletonRow = () => (
  <li className="flex items-center justify-between px-4 py-4 animate-pulse">
    <div className="flex items-start gap-4">
      <div className="h-9 w-9 rounded-md bg-gray-200" />
      <div className="space-y-2">
        <div className="h-4 w-48 rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-3 w-20 rounded bg-gray-200" />
          <div className="h-3 w-16 rounded bg-gray-200" />
        </div>
      </div>
    </div>
    <div className="flex gap-2">
      <div className="h-8 w-16 rounded bg-gray-200" />
      <div className="h-8 w-8 rounded bg-gray-200" />
    </div>
  </li>
);

export default function MeetingPage() {
  const { projectId, projects } = useProject();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  const project = projects?.find((p) => p.id === projectId) || null;

  const fetchMeetings = async () => {
    if (!project?.id) return;

    try {
      if (initialLoad) setLoading(true);

      const res = await fetch(`/api/meeting/${project.id}`);
      const data = await res.json();
      setMeetings(data.meetings ?? []);

      if (initialLoad) setInitialLoad(false);
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
    } finally {
      if (initialLoad) setLoading(false);
    }
  };

  const handleDelete = async (meetingId: string) => {
    if (!window.confirm("Delete this meeting permanently?")) return;

    try {
      const res = await fetch(`/api/meeting/${meetingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Meeting deleted");
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    } catch {
      toast.error("Failed to delete meeting");
    }
  };

  useEffect(() => {
    fetchMeetings();

    const interval = setInterval(() => {
      const hasProcessing = meetings.some(
        (m) => m.status === "processing"
      );

      if (hasProcessing) {
        fetchMeetings();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [project?.id, meetings]);

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl py-12 text-center">
        <h1 className="text-lg sm:text-xl font-semibold">
          Select a project
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Choose a project from the sidebar to view meetings.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-6 space-y-6">
        <MeetingCard project={project} />

        <Card>
          <div className="border-b px-4 py-3 sm:px-6">
            <h2 className="text-base sm:text-lg font-semibold">
              All Meetings
            
            </h2>
          </div>

          {loading && initialLoad && (
            <ul className="divide-y">
              <MeetingSkeletonRow />
              <MeetingSkeletonRow />
              <MeetingSkeletonRow />
            </ul>
          )}


          {!loading && meetings.length === 0 && (
            <div className="text-center py-12 sm:py-16 px-4">
              <div className="mx-auto max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Presentation className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-base font-medium text-gray-900 mb-2">
                  No meetings yet.
                </h3>
                <p className="text-sm text-gray-500">
                  Upload your first meeting to get started with AI-powered analysis & issues.
                </p>
              </div>
            </div>
          )}

    
          {!loading && meetings.length > 0 && (
            <ul className="divide-y">
              {meetings.map((meeting) => (
                <li
                  key={meeting.id}
                  className="
                    flex flex-col gap-4
                    sm:flex-row sm:items-center sm:justify-between
                    px-4 py-4 sm:px-6
                    hover:bg-gray-50 transition
                  "
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-1 rounded-md bg-primary/10 p-2 shrink-0">
                      <Presentation className="h-5 w-5 text-primary" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/meeting/${meeting.id}`}
                        className="block truncate font-medium text-sm sm:text-base hover:underline hover:text-primary"
                      >
                        {meeting.name}
                      </Link>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500">
                        <time>
                          {new Date(meeting.createdAt).toLocaleDateString()}
                        </time>
                        <span className="hidden sm:inline">•</span>
                        <StatusBadge status={meeting.status} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/meeting/${meeting.id}`}>
                      <Button variant="outline" size="sm" className="cursor-pointer">
                        View
                      </Button>
                    </Link>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(meeting.id)}
                      className="cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4 text-red-600 " />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
