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
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
};

const MeetingSkeletonRow = () => {
  return (
    <li className="flex items-center justify-between px-6 py-4 animate-pulse">
      {/* Left */}
      <div className="flex items-start gap-4 min-w-0">
        <div className="h-9 w-9 rounded-md bg-gray-200" />

        <div className="space-y-2">
          <div className="h-4 w-48 rounded bg-gray-200" />
          <div className="flex gap-2">
            <div className="h-3 w-20 rounded bg-gray-200" />
            <div className="h-3 w-16 rounded bg-gray-200" />
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex gap-2">
        <div className="h-8 w-16 rounded bg-gray-200" />
        <div className="h-8 w-8 rounded bg-gray-200" />
      </div>
    </li>
  );
};

const MeetingsSkeletonList = () => {
  return (
    <ul className="divide-y">
      {Array.from({ length: 5 }).map((_, i) => (
        <MeetingSkeletonRow key={i} />
      ))}
    </ul>
  );
};


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
    } catch (err) {
      console.error("Failed to fetch meetings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (meetingId: string) => {
    const confirm = window.confirm("Delete this meeting permanently?");
    if (!confirm) return;

    try {
      const res = await fetch(`/api/meeting/${meetingId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete failed");

      toast.success("Meeting deleted");
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    } catch (err) {
      console.error(err);
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
      <div className="mx-auto max-w-5xl p-10 text-center">
        <h1 className="text-xl font-semibold text-gray-800">
          Select a project
        </h1>
        <p className="text-gray-600 mt-1">
          Choose a project from the sidebar to view and upload meetings.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      {/* Upload */}
      <MeetingCard project={project} />

      {/* All Meetings */}
      <Card className="w-full">
        <div className="border-b px-6 py-4">
          <h2 className=" text-xl font-semibold text-gray-900">All Meetings</h2>
        </div>

        {loading && meetings.length === 0 && <MeetingsSkeletonList />}


        {!loading && meetings.length === 0 && (
          <p className="px-6 py-8 text-sm text-gray-500">
            No meetings yet. Upload your first one 🎙️
          </p>
        )}

        <ul className="divide-y">
  {meetings.map((meeting) => (
    <li
      key={meeting.id}
      className="flex items-center justify-between px-6 py-4 transition hover:bg-gray-50"
    >
      {/* Left side (NOT clickable except link) */}
      <div className="flex items-start gap-4 min-w-0">
        <div className="mt-1 rounded-md bg-gray-100 p-2">
          🎙️
        </div>

        <div className="min-w-0">
          {/* ONLY this text is clickable */}
          <Link
            href={`/meeting/${meeting.id}`}
            className="block font-medium text-gray-900 hover:underline truncate cursor-pointer"
          >
            {meeting.name}
          </Link>

          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <time dateTime={meeting.createdAt}>
              {new Date(meeting.createdAt).toLocaleDateString()}
            </time>
            <span>•</span>
            <StatusBadge status={meeting.status} />
          </div>
        </div>
      </div>

      {/* Actions (ONLY buttons clickable) */}
      <div className="flex items-center gap-2 flex-none">
        <Link href={`/meeting/${meeting.id}`} className="cursor-pointer">
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="cursor-pointer"
          >
            View
          </Button>
        </Link>

        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => handleDelete(meeting.id)}
          className="cursor-pointer"
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    </li>
  ))}
</ul>

      </Card>
    </div>
  );
}

