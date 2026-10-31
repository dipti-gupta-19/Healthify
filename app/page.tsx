import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, ClipboardList, ArrowRight, Heart, Brain, Clock, ShieldCheck, Sparkles, TrendingUp, ChevronRight } from 'lucide-react';
import { ProfileBanner } from '@/components/profile-banner';
import { HealthCheckinBanner } from '@/components/health-checkin-banner';

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 animate-fade-in space-y-10">
      {/* HERO SECTION */}
      <section className="text-center max-w-3xl mx-auto pt-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary mb-5 shadow-xs">
          <Sparkles className="h-3.5 w-3.5" />
          Personalized Nutrition & Food Science
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance mb-4">
          Know your food.{' '}
          <span className="bg-gradient-to-r from-primary via-emerald-500 to-teal-400 bg-clip-text text-transparent">
            Eat smarter.
          </span>
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground text-balance max-w-2xl mx-auto mb-6 leading-relaxed">
          Instant packaged food additive detection, photo meal recognition, and daily wellness recommendations tailored to how you feel today.
        </p>
        <ProfileBanner />
      </section>

      {/* DAILY HEALTH CHECK-IN BANNER ON HOME PAGE */}
      <section>
        <HealthCheckinBanner />
      </section>

      {/* QUICK SCAN ACTION CARDS */}
      <section className="grid sm:grid-cols-2 gap-6">
        <Link href="/scan/packaged" className="group block focus-visible:outline-none">
          <Card className="relative h-full overflow-hidden p-6 sm:p-8 border border-border/80 glass-card card-interactive shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4 shadow-md group-hover:scale-105 transition-transform">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">Packaged Food Scanner</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-5 leading-relaxed">
              Scan barcode or paste ingredients. Detect harmful additives, hidden sugars, and allergens instantly.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-6">
              {['Additive Detection', 'Barcode Lookup', 'Allergen Warnings'].map((t) => (
                <span key={t} className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {t}
                </span>
              ))}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:underline">
              Scan Packaged Food <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Card>
        </Link>

        <Link href="/scan/unpackaged" className="group block focus-visible:outline-none">
          <Card className="relative h-full overflow-hidden p-6 sm:p-8 border border-border/80 glass-card card-interactive shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white mb-4 shadow-md group-hover:scale-105 transition-transform">
              <Camera className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold mb-2 group-hover:text-emerald-500 transition-colors">Unpackaged Meal Recognition</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-5 leading-relaxed">
              Snap a photo of home-cooked meals or restaurant dishes. Automatically identifies ingredients & computes nutrition.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-6">
              {['Photo Recognition', 'Home Dishes', 'Nutrition Breakdown'].map((t) => (
                <span key={t} className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {t}
                </span>
              ))}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
              Recognize a Meal <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Card>
        </Link>
      </section>

      {/* WHY HEALTHIFY */}
      <section>
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-1">Why Healthify?</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">More than calorie counting — intelligent nutrition science.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Heart, title: 'Personalized Verdict', desc: 'Custom safety ratings calibrated to your health conditions.' },
            { icon: Clock, title: 'Schedule Tracking', desc: 'Tracks meal timing intervals and alerts on skipped meals.' },
            { icon: Brain, title: 'Additive Safety', desc: 'Identifies ultra-processed dyes, emulsifiers and preservatives.' },
            { icon: ShieldCheck, title: 'Allergen Shield', desc: 'Instant warnings for your configured food allergies.' },
          ].map((f) => (
            <Card key={f.title} className="p-5 border border-border/80 glass-card card-interactive shadow-2xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="rounded-2xl border-2 border-primary/20 bg-gradient-to-r from-primary/10 via-background to-secondary/40 p-6 sm:p-8 text-center shadow-sm">
        <TrendingUp className="h-8 w-8 text-primary mx-auto mb-3" />
        <h2 className="text-xl sm:text-2xl font-bold mb-2">Start eating healthier today</h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mb-5">
          Configure your health profile once, and every scanned food gets analyzed specifically for your body.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/profile">
            <Button size="sm" className="gap-1.5 text-xs font-semibold h-10 px-4">
              Setup Profile <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm" variant="outline" className="text-xs font-semibold h-10 px-4">
              View Dashboard
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
