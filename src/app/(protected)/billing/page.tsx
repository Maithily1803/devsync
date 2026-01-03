"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { CREDIT_PLANS } from "@/lib/credit-plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Zap, 
  Check, 
  CreditCard, 
  TrendingUp, 
  Clock,
  Loader2,
  Sparkles,
  RefreshCw
} from "lucide-react";

type CreditStats = {
  current: number;
  totalSpent: number;
  lastMonthUsage: number;
};

type UsageItem = {
  id: string;
  action: string;
  credits: number;
  description: string | null;
  createdAt: string;
  project?: { name: string } | null;
};

export default function BillingPage() {
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [history, setHistory] = useState<UsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  const fetchCredits = async () => {
    try {
      const res = await fetch("/api/credits/stats");
      const data = await res.json();

      setStats(data.stats ?? null);
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (error) {
      console.error("Failed to fetch credits:", error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  const buyCredits = async (planId: string) => {
    try {
      setPurchasing(true);
      const res = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const { order, plan } = await res.json();

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: order.id,
        amount: order.amount,
        currency: "INR",
        name: "Devsync",
        description: `${plan.name} - ${plan.credits} Credits`,
        image: "/logo.png",
        
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });

            const data = await verifyRes.json();

            if (data.success) {
              toast.success(`${data.credits} credits added! 🎉`);
              fetchCredits();
            } else {
              toast.error("Payment verification failed");
            }
          } catch (error) {
            toast.error("Failed to verify payment");
          }
        },

        prefill: { email: "" },
        theme: { color: "#E8AF4C" },

        modal: {
          ondismiss: () => {
            setPurchasing(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();

      rzp.on("payment.failed", () => {
        toast.error("Payment failed. Please try again.");
        setPurchasing(false);
      });
    } catch (error) {
      toast.error("Failed to initiate payment");
      setPurchasing(false);
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      QUESTION_ASKED: "Q&A Session",
      MEETING_TRANSCRIBED: "Meeting Transcription",
      EMBEDDING_GENERATED: "Code Embedding",
      COMMIT_ANALYSIS: "Commit Analysis",
    };
    return labels[action] || action;
  };

  const creditPercentage = Math.min((stats?.current || 0) / 100, 1) * 100;
  const isLowCredits = (stats?.current || 0) < 50;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Zap className="h-7 w-7 text-primary" />
              Credits
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your AI credits
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCredits}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Current Balance
                </span>
                <Zap className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.current || 0}</div>
              {isLowCredits && (
                <Badge variant="destructive" className="mt-2 text-xs">
                  Low Balance
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Used
                </span>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalSpent || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Last 30 Days
                </span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats?.lastMonthUsage || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plans */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Buy Credits
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            {CREDIT_PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.popular ? "ring-2 ring-primary shadow-lg" : ""
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs">
                    Popular
                  </Badge>
                )}

                <CardHeader>
                  <div>
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan.description}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">₹{plan.price}</span>
                      <span className="text-sm text-muted-foreground">one-time</span>
                    </div>
                    <p className="text-sm text-primary font-semibold mt-1">
                      {plan.credits} Credits
                    </p>
                  </div>

                  <ul className="space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => buyCredits(plan.id)}
                    disabled={purchasing}
                  >
                    {purchasing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Buy Now
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        {history.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Recent Activity</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {getActionLabel(item.action)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      -{item.credits}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
