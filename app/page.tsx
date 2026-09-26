import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, ClipboardList, ArrowRight, Heart, Brain, Clock, ShieldCheck, Sparkles, TrendingUp, ChevronRight } from 'lucide-react';
import { ProfileBanner } from '@/components/profile-banner';

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 animate-fade-in">
      {/* HERO SECTION */}
      <section className="text-center max-w-3xl mx-auto mb-10 pt-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary mb-5 shadow-xs">
          <Sparkles className="h-3.5 w-3.5" />
          AI-Powered Nutrition Intelligence
        </div>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance mb-4">
          Know your food.{' '}
          <span className="bg-gradient-to-r from-primary via-emerald-500 to-teal-400 bg-clip-text text-transparent">
            Eat smarter.
          </span>
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground text-balance max-w-2xl mx-auto mb-6 leading-relaxed">
          Instant packaged food additive detection, photo meal recognition, and personalized verdicts tailored to your body and goals.
        </p>
        <ProfileBanner />
      </section>

      {/* QUICK SCAN ACTION CARDS */}
      <section className="grid sm:grid-cols-2 gap-5 mb-12">
        <Link href="/scan/packaged" className="group block">
          <Card className="relative h-full overflow-hidden p-6 sm:p-8 transition-all hover:shadow-xl hover:border-primary/50 glass-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4 shadow-md group-hover:scale-105 transition-transform">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">Packaged Food Scanner</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-5">
              Scan barcode or paste ingredients. Detect harmful additives, hidden sugars, and allergens instantly.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-6">
              {['Additive Detection', 'Barcode Lookup', 'Allergen Warnings'].map((t) => (
                <span key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {t}
                </span>
              ))}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary group-hover:underline">
              Scan Packaged Food <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Card>
        </Link>

        <Link href="/scan/unpackaged" className="group block">
          <Card className="relative h-full overflow-hidden p-6 sm:p-8 transition-all hover:shadow-xl hover:border-emerald-500/50 glass-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white mb-4 shadow-md group-hover:scale-105 transition-transform">
              <Camera className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold mb-2 group-hover:text-emerald-500 transition-colors">Unpackaged Meal Recognition</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-5">
              Snap a photo of home-cooked meals or restaurant dishes. AI recognizes ingredients & computes nutrition.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-6">
              {['Photo Recognition', 'Home Dishes', 'Nutrition Breakdown'].map((t) => (
                <span key={t} className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
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
      <section className="mb-12">
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-1">Why Healthify?</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">More than calorie counting — intelligent nutrition science.</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Heart, title: 'Personalized Verdict', desc: 'Custom safety ratings per your medical conditions.' },
            { icon: Clock, title: 'Schedule Tracking', desc: 'Tracks meal timing and alerts on skipped meals.' },
            { icon: Brain, title: 'Additive Safety', desc: 'Identifies ultra-processed dyes and preservatives.' },
            { icon: ShieldCheck, title: 'Allergen Shield', desc: 'Instant warnings for your selected allergies.' },
          ].map((f) => (
            <Card key={f.title} className="p-4 sm:p-5 border-border/60 hover:border-primary/30 transition-all">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
                <f.icon className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-xs sm:text-sm mb-1">{f.title}</h3>
              <p className="text-[11px] text-muted-foreground leading-normal">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="rounded-2xl border-2 border-primary/20 bg-gradient-to-r from-primary/10 via-background to-secondary/40 p-6 sm:p-8 text-center">
        <TrendingUp className="h-8 w-8 text-primary mx-auto mb-3" />
        <h2 className="text-xl sm:text-2xl font-bold mb-2">Start eating healthier today</h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mb-5">
          Configure your health profile once in MongoDB, and every scanned food gets analyzed specifically for your body.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/profile">
            <Button size="sm" className="gap-1.5 text-xs font-semibold">
              Setup Profile <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm" variant="outline" className="text-xs font-semibold">
              View Dashboard
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
