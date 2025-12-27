"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useProject from "@/hooks/use-project";
import MeetingCard from "../dashboard/meeting-card";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
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

const MeetingsSkeletonList = () => (
  <ul className="divide-y">
    {Array.from({ length: 4 }).map((_, i) => (
      <MeetingSkeletonRow key={i} />
    ))}
  </ul>
);

export default function MeetingPage() {
  const { projectId, projects } = useProject();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const project = projects?.find((p) => p.id === projectId) || null;

  const fetchMeetings = async () => {
    if (!project?.id) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/meeting/${project.id}`);
      const data = await res.json();
      setMeetings(data.meetings ?? []);
    } finally {
      setLoading(false);
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
    const interval = setInterval(fetchMeetings, 5000);
    return () => clearInterval(interval);
  }, [project?.id]);

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl py-12 text-center">
        <h1 className="text-xl font-semibold">Select a project</h1>
        <p className="text-gray-600 mt-1">
          Choose a project from the sidebar to view meetings.
        </p>
      </div>
    );
  }

  return (
    /* 🔑 Key fix: wrapper that DOES NOT stretch vertically */
    <div className="w-full">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-6 space-y-6">
        <MeetingCard project={project} />

        <Card>
          <div className="border-b px-4 py-3 sm:px-6">
            <h2 className="text-2xl sm:text-2xl font-semibold">All Meetings</h2>
          </div>

          {loading && meetings.length === 0 && <MeetingsSkeletonList />}

          {!loading && meetings.length === 0 && (
            <p className="px-4 py-6 text-2xl text-gray-500">
              No meetings yet. Upload your first one 🎙️
            </p>
          )}

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
                  <div className="mt-1 rounded-md bg-gray-100 p-2">🎙️</div>

                  <div className="min-w-0">
                    <Link
                      href={`/meeting/${meeting.id}`}
                      className="text-lg  block font-medium truncate hover:underline"
                    >
                      {meeting.name}
                    </Link>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      <time>{new Date(meeting.createdAt).toLocaleDateString()}</time>
                      <span className="hidden sm:inline">•</span>
                      <StatusBadge status={meeting.status} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/meeting/${meeting.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="
                      cursor-pointer
                      transition-all duration-200
                      hover:bg-primary/10
                      hover:scale-[1.03]
                      active:scale-[0.97]
                    "
                  >
                    View
                  </Button>

                  </Link>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(meeting.id)}
                    className="
                      cursor-pointer
                      transition-all duration-200
                      hover:bg-red-500/10
                      hover:scale-[1.03]
                      active:scale-[0.97]
                    "
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>

                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}


