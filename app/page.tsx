import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, ClipboardList, ArrowRight, Heart, Brain, Clock, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { ProfileBanner } from '@/components/profile-banner';

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
      <section className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground mb-6">
          <Sparkles className="h-4 w-4" />
          AI-Powered Nutrition Intelligence
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance mb-4">
          Know your food.{' '}
          <span className="text-primary">Eat smarter.</span>
        </h1>
        <p className="text-lg text-muted-foreground text-balance">
          Scan packaged food for harmful additives, recognize home-cooked meals from a photo,
          and get a personalized health verdict based on your body and goals.
        </p>
        <ProfileBanner />
      </section>

      <section className="grid md:grid-cols-2 gap-6 mb-16">
        <Link href="/scan/packaged" className="group">
          <Card className="relative h-full overflow-hidden p-8 transition-shadow hover:shadow-lg">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-5">
                <ClipboardList className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Packaged Food</h2>
              <p className="text-muted-foreground mb-6">
                Scan a barcode or paste the ingredient list. We flag harmful additives instantly.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Barcode lookup', 'Additive detection', 'Allergen alerts'].map((t) => (
                  <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    {t}
                  </span>
                ))}
              </div>
              <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                Scan packaged food <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Card>
        </Link>

        <Link href="/scan/unpackaged" className="group">
          <Card className="relative h-full overflow-hidden p-8 transition-shadow hover:shadow-lg">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground mb-5">
                <Camera className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Unpackaged Food</h2>
              <p className="text-muted-foreground mb-6">
                Snap a photo of any meal. AI identifies the dish and returns nutrition facts.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Photo recognition', 'Home-cooked meals', 'Nutrition breakdown'].map((t) => (
                  <span key={t} className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-foreground">
                    {t}
                  </span>
                ))}
              </div>
              <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                Recognize a meal <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Card>
        </Link>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-bold text-center mb-2">Why Healthify is different</h2>
        <p className="text-center text-muted-foreground mb-8">Not just a calorie counter — nutrition intelligence.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Heart, title: 'Personalized verdict', desc: 'Different verdict per your medical profile and goals.' },
            { icon: Clock, title: 'Schedule tracking', desc: 'Tracks when you eat and flags skipped meals.' },
            { icon: Brain, title: 'Additive awareness', desc: 'Scans for harmful additives and artificial dyes.' },
            { icon: ShieldCheck, title: 'Allergen safety', desc: 'Instant warnings for your allergies.' },
          ].map((f) => (
            <Card key={f.title} className="p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary mb-4">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-secondary/50 p-8 sm:p-12 text-center">
        <TrendingUp className="h-10 w-10 text-primary mx-auto mb-4" />
        <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to eat smarter?</h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-6">
          Set up your profile once, and every food you scan gets judged for your body and goals.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/profile">
            <Button size="lg">Create your profile</Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline">View dashboard</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
