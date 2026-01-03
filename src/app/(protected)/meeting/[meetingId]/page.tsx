"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Presentation,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import IssueDialog from "../issue-dialog";
import type { Issue } from "@/lib/issues";

type Meeting = {
  id: string;
  name: string;
  audioUrl: string;
  status: "processing" | "completed" | "failed";
  issues: Issue[] | null;
  createdAt: string;
};

const priorityColors = {
  low: "bg-blue-100 text-blue-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
};

export default function MeetingPage() {
  const params = useParams();
  const meetingId = params.meetingId as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);

  const fetchMeeting = async () => {
    try {
      const res = await fetch(`/api/meeting-detail/${meetingId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMeeting(data.meeting);
    } catch (err) {
      console.error("Failed to fetch meeting", err);
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

    const interval = setInterval(() => {
      if (meeting?.status === "processing") {
        fetchMeeting();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [meetingId, meeting?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-20">
        <h1 className="text-lg font-semibold">Meeting not found</h1>
        <p className="text-sm text-muted-foreground mt-1">
          This meeting may have been deleted.
        </p>
      </div>
    );
  }

  const issues = meeting.issues ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-muted p-2">
            <Presentation className="h-5 w-5 text-muted-foreground" />
          </div>

          <div>
            <h1 className="text-lg sm:text-xl font-semibold leading-tight">
              {meeting.name}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {new Date(meeting.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {meeting.status === "processing" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        )}
      </header>

      <div className="flex items-center gap-2 text-sm">
        {meeting.status === "processing" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />
            <span className="text-yellow-600">Processing</span>
          </>
        )}

        {meeting.status === "completed" && (
          <Badge variant="secondary">Completed</Badge>
        )}

        {meeting.status === "failed" && (
          <Badge variant="destructive">Failed</Badge>
        )}
      </div>

      {/* aud */}
      {meeting.audioUrl && (
        <div className="space-y-1">
          <p className="text-xs sm:text-sm text-muted-foreground">Audio</p>
          <audio controls className="w-full h-9">
            <source src={meeting.audioUrl} />
          </audio>
        </div>
      )}

      {/* issues */}
      {meeting.status === "completed" && (
        <section className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              Issues
              {issues.length > 0 && (
              <Badge variant="outline">{issues.length}</Badge>
            )}
            </h2>

            
          </div>

          {issues.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No issues found.
            </p>
          )}

          <div className="space-y-2">
            {issues.map((issue) => (
              <div
                key={issue.id}
                onClick={() => {
                  setSelectedIssue(issue);
                  setIssueDialogOpen(true);
                }}
                className="
                  group cursor-pointer rounded-lg border
                  px-4 py-3 transition
                  hover:border-primary/40 hover:bg-muted/40
                "
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm sm:text-base font-medium leading-tight">
                      {issue.title}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {issue.description}
                    </p>
                  </div>

                  <Badge
                    className={`shrink-0 ${priorityColors[issue.priority]}`}
                  >
                    {issue.priority}
                  </Badge>
                </div>

                <div className="mt-2 flex items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                  <Badge variant="outline" className="capitalize">
                    {issue.category}
                  </Badge>

                  {issue.timestamp && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {issue.timestamp}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <IssueDialog
        issue={selectedIssue}
        open={issueDialogOpen}
        onOpenChange={setIssueDialogOpen}
      />
    </div>
  );
}
