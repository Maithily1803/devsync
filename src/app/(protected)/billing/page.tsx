"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { CREDIT_PLANS } from "@/lib/credit-plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Zap, 
  Check, 
  CreditCard, 
  TrendingUp, 
  Clock,
  Loader2,
  Sparkles
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

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

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
  try {
    const res = await fetch("/api/credits/stats");
    const data = await res.json();

    setStats(data.stats ?? null);
    setHistory(Array.isArray(data.history) ? data.history : []);
  } catch (error) {
    console.error("Failed to fetch credits:", error);
    setHistory([]); // guarantee array
  } finally {
    setLoading(false);
  }
};

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
              toast.success(`${data.credits} credits added successfully! 🎉`);
              fetchCredits();
            } else {
              toast.error("Payment verification failed");
            }
          } catch (error) {
            toast.error("Failed to verify payment");
          }
        },

        prefill: {
          email: "",
        },

        theme: {
          color: "#E8AF4C",
        },

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const creditPercentage = Math.min((stats?.current || 0) / 100, 1) * 100;
  const isLowCredits = (stats?.current || 0) < 50;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Zap className="h-8 w-8 text-primary" />
            Credits & Billing
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your AI credits and view usage history
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Current Balance
              </CardTitle>
              <Zap className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.current || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                AI Credits available
              </p>
              <Progress 
                value={creditPercentage} 
                className="mt-3"
              />
              {isLowCredits && (
                <Badge variant="destructive" className="mt-2">
                  Low Balance
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Spent
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalSpent || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Credits consumed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Last 30 Days
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats?.lastMonthUsage || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Credits used this month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Credit Plans */}
        <div>
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Choose Your Plan
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {CREDIT_PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.popular
                    ? "ring-2 ring-primary shadow-lg scale-105"
                    : ""
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}

                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">₹{plan.price}</span>
                      <span className="text-muted-foreground">one-time</span>
                    </div>
                    <p className="text-sm text-primary font-semibold mt-1">
                      {plan.credits} AI Credits
                    </p>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    size="lg"
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

        {/* Usage History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No activity yet. Start using Devsync to see your usage here!
              </p>
            ) : (
              <div className="space-y-4">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {getActionLabel(item.action)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()}
                          {item.project && ` • ${item.project.name}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">-{item.credits} credits</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Note */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <p className="text-sm text-center text-muted-foreground">
              💳 Secure payments powered by Razorpay • 🔒 All transactions are encrypted
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}