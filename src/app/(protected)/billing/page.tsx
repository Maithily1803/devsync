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

  // ✅ per-plan purchasing state
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);

  const fetchCredits = async () => {
    try {
      const res = await fetch("/api/credits/stats");
      const data = await res.json();

      setStats(data.stats ?? null);
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (err) {
      console.error(err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔁 auto refresh
  useEffect(() => {
    fetchCredits();
    const interval = setInterval(fetchCredits, 30000);
    return () => clearInterval(interval);
  }, []);

  const buyCredits = async (planId: string) => {
    if (purchasingPlanId) return;

    try {
      setPurchasingPlanId(planId);

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
              toast.success(`${data.credits} credits added!`);
              fetchCredits();
            } else {
              toast.error("Payment verification failed");
            }
          } catch {
            toast.error("Verification error");
          } finally {
            setPurchasingPlanId(null);
          }
        },

        modal: {
          ondismiss: () => setPurchasingPlanId(null),
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();

      rzp.on("payment.failed", () => {
        toast.error("Payment failed");
        setPurchasingPlanId(null);
      });
    } catch {
      toast.error("Failed to initiate payment");
      setPurchasingPlanId(null);
    }
  };

  const getActionLabel = (action: string) => {
    const map: Record<string, string> = {
      QUESTION_ASKED: "Q&A Session",
      MEETING_ISSUES_GENERATED: "Issues Generated",
      EMBEDDING_GENERATED: "Code Embedding",
      COMMIT_ANALYSIS: "Commit Analysis",
    };
    return map[action] || action;
  };

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

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Credits
          </h1>
          <p className="text-sm text-muted-foreground">
            Credits are used for AI-powered analysis, issues, and Q&A
          </p>
        </div>



        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <span className="text-sm text-muted-foreground">
                Current Balance
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">
                {stats?.current ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <span className="text-sm text-muted-foreground">Total Used</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">
                {stats?.totalSpent ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <span className="text-sm text-muted-foreground">
                Last 30 Days
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">
                {stats?.lastMonthUsage ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Credit Usage Info */}
<div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground border rounded-md px-3 py-2">
  <span className="font-medium text-foreground">Credit usage:</span>

  <span>Issues- <Badge variant="outline">25</Badge></span>
  <span>Q&A- <Badge variant="outline">10</Badge></span>
 
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
                className={`relative flex flex-col ${
                  plan.popular ? "ring-2 ring-primary" : ""
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute top-2 right-2">Popular</Badge>
                )}

                <CardHeader>
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {plan.description}
                  </p>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 space-y-4">
                  <div>
                    <span className="text-2xl sm:text-3xl font-bold">
                      ₹{plan.price}
                    </span>
                    <p className="text-sm text-primary font-semibold">
                      {plan.credits} Credits
                    </p>
                  </div>

                  <ul className="space-y-2 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full cursor-pointer"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => buyCredits(plan.id)}
                    disabled={!!purchasingPlanId}
                  >
                    {purchasingPlanId === plan.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Buy Now
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>


        {history.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Recent Activity</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {getActionLabel(item.action)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="secondary">-{item.credits}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}


