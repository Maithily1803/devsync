// src/app/api/billing/verify/route.ts
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    console.log("🔐 Payment verification started");

    const body = await req.json();
    console.log("📥 Received data:", {
      hasOrderId: !!body.razorpay_order_id,
      hasPaymentId: !!body.razorpay_payment_id,
      hasSignature: !!body.razorpay_signature,
    });

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error("❌ Missing required fields");
      return NextResponse.json(
        { error: "Missing required payment data" },
        { status: 400 }
      );
    }

    // Verify signature
    console.log("🔍 Verifying signature...");
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error("❌ Invalid signature");
      console.error("Expected:", expectedSignature);
      console.error("Received:", razorpay_signature);
      
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    console.log("✅ Signature verified successfully");

    // Find payment record
    console.log("🔍 Finding payment record...");
    const payment = await db.payment.findFirst({
      where: { razorpayOrder: razorpay_order_id },
    });

    if (!payment) {
      console.error("❌ Payment record not found:", razorpay_order_id);
      return NextResponse.json(
        { error: "Payment record not found" },
        { status: 404 }
      );
    }

    console.log("✅ Payment record found:", payment.id);

    // Check if already processed
    if (payment.status === "paid") {
      console.log("⚠️ Payment already processed");
      return NextResponse.json({
        success: true,
        credits: payment.credits,
        message: "Payment already processed",
      });
    }

    // Update payment and add credits in transaction
    console.log("💾 Updating payment and adding credits...");
    
    const [updatedPayment, updatedUser] = await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPayId: razorpay_payment_id,
          status: "paid",
        },
      }),
      db.user.update({
        where: { id: payment.userId },
        data: {
          credits: { increment: payment.credits },
        },
        select: { credits: true },
      }),
    ]);

    console.log("✅ Payment verified and credits added");
    console.log("💰 Credits added:", payment.credits);
    console.log("💰 New balance:", updatedUser.credits);

    return NextResponse.json({
      success: true,
      credits: payment.credits,
      newBalance: updatedUser.credits,
    });
  } catch (error: any) {
    console.error("❌ Payment verification error:", error);
    console.error("Stack:", error.stack);
    
    return NextResponse.json(
      { 
        error: "Payment verification failed",
        details: error.message 
      },
      { status: 500 }
    );
  }
}