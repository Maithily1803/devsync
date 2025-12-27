"use client"

import Script from "next/script"
import { CREDIT_PLANS } from "@/lib/credit-plans"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function BillingPage() {
  const buyCredits = async (planId: string) => {
    const res = await fetch("/api/billing/create-order", {
      method: "POST",
      body: JSON.stringify({ planId }),
    })

    const { order } = await res.json()

    const rzp = new (window as any).Razorpay({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      order_id: order.id,
      amount: order.amount,
      currency: "INR",

      method: {
    card: true,
    upi: true,
    netbanking: false,
    wallet: false,
    emi: false,
    paylater: false,
  },

  

      handler: async (response: any) => {
        await fetch("/api/billing/verify", {
          method: "POST",
          body: JSON.stringify(response),
        })
        toast.success("Credits added!")
      },
    })

    rzp.open()
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div className="max-w-4xl mx-auto py-10 space-y-6">
        <h1 className="text-2xl font-semibold">Buy Credits</h1>

        <div className="grid sm:grid-cols-3 gap-4">
          {CREDIT_PLANS.map(plan => (
            <div key={plan.id} className="border rounded-lg p-5 space-y-3">
              <h2 className="text-lg font-medium capitalize">{plan.id}</h2>
              <p className="text-sm text-muted-foreground">
                {plan.credits} credits
              </p>
              <p className="text-xl font-semibold">₹{plan.price}</p>

              <Button 
                className="w-full cursor-pointer"
                onClick={() => buyCredits(plan.id)}
              >
                Buy
              </Button>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          ⚠️ Demo billing — payments are simulated (Razorpay Test Mode)
        </p>
      </div>
    </>
  )
}
