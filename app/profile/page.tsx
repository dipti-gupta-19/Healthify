'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/components/profile-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Activity, Target, Stethoscope, AlertTriangle } from 'lucide-react';
import type { UserProfile, Sex, ActivityLevel, Goal, MedicalCondition } from '@/lib/nutrition';
import { calculateTargets } from '@/lib/nutrition';
import { toast } from 'sonner';

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little exercise)',
  light: 'Light (1-3 days/week)',
  moderate: 'Moderate (3-5 days/week)',
  active: 'Active (6-7 days/week)',
  very_active: 'Very Active (intense daily)',
};

const COMMON_ALLERGIES = ['peanut', 'tree nuts', 'milk', 'egg', 'soy', 'wheat', 'fish', 'shellfish', 'sesame', 'mustard'];

export default function ProfilePage() {
  const { profile, saveProfile, loading } = useProfile();
  const [form, setForm] = useState<UserProfile>({
    name: '',
    age: 25,
    sex: 'male',
    weightKg: 70,
    heightCm: 170,
    activityLevel: 'moderate',
    goal: 'maintain',
    medicalConditions: [],
    allergies: [],
  });
  const [allergyInput, setAllergyInput] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const targets = calculateTargets(form);

  const toggleMedical = (c: MedicalCondition) => {
    setForm((f) => ({
      ...f,
      medicalConditions: f.medicalConditions.includes(c)
        ? f.medicalConditions.filter((x) => x !== c)
        : [...f.medicalConditions, c],
    }));
  };

  const addAllergy = (a: string) => {
    const trimmed = a.trim();
    if (trimmed && !form.allergies.includes(trimmed)) {
      setForm((f) => ({ ...f, allergies: [...f.allergies, trimmed] }));
    }
    setAllergyInput('');
  };

  const removeAllergy = (a: string) => {
    setForm((f) => ({ ...f, allergies: f.allergies.filter((x) => x !== a) }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    await saveProfile(form);
    setSaved(true);
    toast.success('Profile saved! Your nutrition targets are ready.');
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">Your Health Profile</h1>
      <p className="text-muted-foreground mb-8">This powers your personalized food verdicts. Update anytime.</p>

      <div className="space-y-6">
        <Card className="p-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-5">
            <UserIcon />
            <h2 className="text-lg font-semibold">Basic Info</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
            </div>
            <div>
              <Label htmlFor="age">Age</Label>
              <Input id="age" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: +e.target.value })} />
            </div>
            <div>
              <Label>Sex</Label>
              <Select value={form.sex} onValueChange={(v: Sex) => setForm({ ...form, sex: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input id="weight" type="number" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: +e.target.value })} />
            </div>
            <div>
              <Label htmlFor="height">Height (cm)</Label>
              <Input id="height" type="number" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: +e.target.value })} />
            </div>
            <div>
              <Label>Activity Level</Label>
              <Select value={form.activityLevel} onValueChange={(v: ActivityLevel) => setForm({ ...form, activityLevel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-5">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Goal</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              { v: 'loss', label: 'Weight Loss', desc: '-500 kcal/day' },
              { v: 'maintain', label: 'Maintain', desc: 'Balance' },
              { v: 'gain', label: 'Muscle Gain', desc: '+400 kcal/day' },
            ] as const).map((g) => (
              <button
                key={g.v}
                onClick={() => setForm({ ...form, goal: g.v })}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  form.goal === g.v
                    ? 'border-primary bg-secondary text-secondary-foreground'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="font-semibold">{g.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{g.desc}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-5">
            <Stethoscope className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Medical Conditions</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">These adjust your safe thresholds for sugar, sodium, and fat.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {([
              { v: 'none', label: 'None' },
              { v: 'diabetes', label: 'Diabetes' },
              { v: 'hypertension', label: 'Hypertension' },
              { v: 'cholesterol', label: 'High Cholesterol' },
              { v: 'pcos', label: 'PCOS' },
            ] as const).map((c) => (
              <button
                key={c.v}
                onClick={() => toggleMedical(c.v)}
                className={`rounded-xl border-2 p-3 text-sm font-medium transition-all ${
                  form.medicalConditions.includes(c.v)
                    ? 'border-primary bg-secondary text-secondary-foreground'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold">Allergies</h2>
          </div>
          <div className="flex gap-2 mb-3">
            <Input
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAllergy(allergyInput)}
              placeholder="Type an allergy and press Enter"
            />
            <Button onClick={() => addAllergy(allergyInput)} size="icon" variant="outline"><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {COMMON_ALLERGIES.map((a) => (
              <button
                key={a}
                onClick={() => addAllergy(a)}
                className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition"
              >
                + {a}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {form.allergies.map((a) => (
              <Badge key={a} variant="secondary" className="gap-1 pr-1.5">
                {a}
                <button onClick={() => removeAllergy(a)} className="ml-0.5 rounded-full hover:bg-muted p-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        </Card>

        <Card className="p-6 animate-slide-up bg-gradient-to-br from-secondary/50 to-transparent">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Your Daily Targets</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Calories" value={targets.calories} unit="kcal" />
            <Stat label="Protein" value={targets.protein} unit="g" />
            <Stat label="Carbs" value={targets.carbs} unit="g" />
            <Stat label="Fat" value={targets.fat} unit="g" />
            <Stat label="Fiber" value={targets.fiber} unit="g" />
            <Stat label="Sugar Max" value={targets.sugarMax} unit="g" />
            <Stat label="Sodium Max" value={targets.sodiumMax} unit="mg" />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Calculated with the Mifflin-St Jeor equation, adjusted for your activity level, goal, and medical conditions.
          </p>
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Button size="lg" onClick={handleSubmit}>Save Profile</Button>
        </div>
        {saved && (
          <div className="text-center text-sm text-success pb-8 animate-fade-in">
            Profile saved — head to the scan pages to analyze food!
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl bg-background/60 p-4 text-center">
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{unit}</div>
      <div className="text-xs font-medium mt-1">{label}</div>
    </div>
  );
}

function UserIcon() {
  return (
    <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
