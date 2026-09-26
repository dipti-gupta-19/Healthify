'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/components/profile-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Plus,
  Activity,
  Target,
  Stethoscope,
  AlertTriangle,
  Edit3,
  Check,
  User,
  ShieldCheck,
  Scale,
  Ruler,
  Flame,
  Utensils,
  Lock,
} from 'lucide-react';
import type { UserProfile, Sex, ActivityLevel, MedicalCondition, DietType } from '@/lib/nutrition';
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
  const { user, profile, saveProfile, loading, setAuthModalOpen } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<UserProfile>({
    name: '',
    age: 25,
    sex: 'male',
    weightKg: 70,
    heightCm: 170,
    activityLevel: 'moderate',
    goal: 'maintain',
    dietType: 'vegetarian',
    medicalConditions: [],
    allergies: [],
  });

  const [allergyInput, setAllergyInput] = useState('');

  useEffect(() => {
    if (profile) {
      setForm(profile);
    } else if (user) {
      setForm((f) => ({ ...f, name: user.name }));
    }
  }, [profile, user]);

  const currentProfile = isEditing ? form : profile || form;
  const targets = calculateTargets(currentProfile);

  // BMI calculation
  const heightM = currentProfile.heightCm / 100;
  const bmi = heightM > 0 ? (currentProfile.weightKg / (heightM * heightM)).toFixed(1) : '22.0';
  const getBmiCategory = (val: number) => {
    if (val < 18.5) return { label: 'Underweight', color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' };
    if (val < 25) return { label: 'Normal weight', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' };
    if (val < 30) return { label: 'Overweight', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' };
    return { label: 'Obese', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30' };
  };
  const bmiCat = getBmiCategory(parseFloat(bmi));

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

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    setSaving(true);
    try {
      await saveProfile(form);
      setIsEditing(false);
      toast.success('Profile saved to MongoDB successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) setForm(profile);
    setIsEditing(false);
  };

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-pulse text-sm font-semibold text-muted-foreground">Loading profile from MongoDB...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 animate-fade-in">
      {/* Account / Auth banner if not logged in */}
      {!user && (
        <Card className="p-5 mb-8 border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                You are currently viewing a local profile.
              </p>
              <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                Sign in or Register to save and sync your health profile across devices in MongoDB!
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setAuthModalOpen(true)} className="shrink-0 text-xs font-bold px-4 h-10">
            Sign In / Register
          </Button>
        </Card>
      )}

      {/* Main Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center text-primary-foreground text-2xl font-extrabold shadow-md">
            {(currentProfile.name || user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold">{currentProfile.name || 'Your Profile'}</h1>
              <Badge variant="outline" className="gap-1 border-primary/40 text-primary font-bold text-xs px-2.5 py-0.5">
                <ShieldCheck className="h-3.5 w-3.5" /> MongoDB Synced
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {user?.email ? user.email : 'Personalized Health & Nutrition Profile'}
            </p>
          </div>
        </div>

        <div>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} className="gap-2 text-sm font-bold px-5 h-11 shadow-sm">
              <Edit3 className="h-4 w-4" /> Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={saving} className="h-11 px-5 text-sm font-bold">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2 h-11 px-5 text-sm font-bold">
                <Check className="h-4 w-4" /> Save Changes
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW PERSPECTIVE */}
      {!isEditing ? (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-5 flex items-center gap-4 glass-card">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <User className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Age & Sex</p>
                <p className="text-base sm:text-lg font-bold capitalize">
                  {currentProfile.age} yrs, {currentProfile.sex}
                </p>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4 glass-card">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Scale className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Weight</p>
                <p className="text-base sm:text-lg font-bold">{currentProfile.weightKg} kg</p>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4 glass-card">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Ruler className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Height</p>
                <p className="text-base sm:text-lg font-bold">{currentProfile.heightCm} cm</p>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4 glass-card">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">BMI Index</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-base sm:text-lg font-bold">{bmi}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${bmiCat.color}`}>
                    {bmiCat.label}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Diet & Goal Cards */}
          <div className="grid sm:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Utensils className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Dietary Preference</h2>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-secondary/30">
                <span className="text-4xl">
                  {currentProfile.dietType === 'vegetarian' ? '🥗' : '🍗'}
                </span>
                <div>
                  <p className="font-bold capitalize text-base">
                    {currentProfile.dietType === 'vegetarian' ? 'Vegetarian' : 'Non-Vegetarian'}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {currentProfile.dietType === 'vegetarian'
                      ? 'No meat or fish. Scanners warn on non-veg ingredients.'
                      : 'Includes all foods, poultry, meat, and fish.'}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Fitness Goal</h2>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-secondary/30">
                <span className="text-4xl">
                  {currentProfile.goal === 'loss' ? '🔥' : currentProfile.goal === 'gain' ? '💪' : '⚖️'}
                </span>
                <div>
                  <p className="font-bold capitalize text-base">
                    {currentProfile.goal === 'loss'
                      ? 'Weight Loss (-500 kcal/day)'
                      : currentProfile.goal === 'gain'
                      ? 'Muscle Gain (+400 kcal/day)'
                      : 'Maintain Weight (Balance)'}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Activity: {ACTIVITY_LABELS[currentProfile.activityLevel] || currentProfile.activityLevel}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Medical Conditions & Allergies */}
          <div className="grid sm:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Stethoscope className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">Medical Conditions</h2>
              </div>
              {currentProfile.medicalConditions.length === 0 || currentProfile.medicalConditions.includes('none' as any) ? (
                <p className="text-sm text-muted-foreground">No specific medical conditions selected.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentProfile.medicalConditions.map((c) => (
                    <Badge key={c} variant="secondary" className="px-3 py-1 text-sm font-bold capitalize">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-bold">Allergies & Intolerances</h2>
              </div>
              {currentProfile.allergies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No allergies specified.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentProfile.allergies.map((a) => (
                    <Badge key={a} variant="destructive" className="px-3 py-1 text-sm font-bold">
                      {a}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Daily Nutrition Targets Card */}
          <Card className="p-6 bg-gradient-to-br from-primary/10 via-background to-secondary/30 border-2 border-primary/20 shadow-md">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Flame className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-bold">Calculated Daily Nutrition Targets</h2>
              </div>
              <Badge variant="secondary" className="text-xs font-bold px-3 py-1">
                Mifflin-St Jeor Formula
              </Badge>
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
          </Card>
        </div>
      ) : (
        /* EDIT PERSPECTIVE */
        <div className="space-y-6 animate-fade-in">
          <Card className="p-6 border-2 border-primary/40">
            <h2 className="text-lg font-bold mb-2">🥗 Veg or Non-Veg Preference</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Choose your food preference. Scanners analyze ingredients against this choice.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { v: 'vegetarian' as DietType, label: 'Vegetarian', emoji: '🥗', desc: 'No meat or fish' },
                { v: 'non_vegetarian' as DietType, label: 'Non-Vegetarian', emoji: '🍗', desc: 'Includes all foods' },
              ].map((d) => (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => setForm({ ...form, dietType: d.v })}
                  className={`rounded-xl border-2 p-5 text-left transition-all ${
                    form.dietType === d.v
                      ? 'border-primary bg-primary/10 font-bold'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-3xl mb-1">{d.emoji}</div>
                  <div className="font-bold text-base">{d.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{d.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Basic Information
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-sm font-semibold">Full Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                  className="text-sm h-11"
                />
              </div>
              <div>
                <Label htmlFor="age" className="text-sm font-semibold">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: +e.target.value })}
                  className="text-sm h-11"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold">Sex</Label>
                <Select value={form.sex} onValueChange={(v: Sex) => setForm({ ...form, sex: v })}>
                  <SelectTrigger className="text-sm h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="weight" className="text-sm font-semibold">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={form.weightKg}
                  onChange={(e) => setForm({ ...form, weightKg: +e.target.value })}
                  className="text-sm h-11"
                />
              </div>
              <div>
                <Label htmlFor="height" className="text-sm font-semibold">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={form.heightCm}
                  onChange={(e) => setForm({ ...form, heightCm: +e.target.value })}
                  className="text-sm h-11"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold">Activity Level</Label>
                <Select
                  value={form.activityLevel}
                  onValueChange={(v: ActivityLevel) => setForm({ ...form, activityLevel: v })}
                >
                  <SelectTrigger className="text-sm h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-primary" /> Fitness Goal
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: 'loss', label: 'Weight Loss', desc: '-500 kcal/day' },
                { v: 'maintain', label: 'Maintain', desc: 'Balance' },
                { v: 'gain', label: 'Muscle Gain', desc: '+400 kcal/day' },
              ].map((g) => (
                <button
                  key={g.v}
                  type="button"
                  onClick={() => setForm({ ...form, goal: g.v as any })}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    form.goal === g.v
                      ? 'border-primary bg-primary/10 font-bold'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-bold text-sm sm:text-base">{g.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{g.desc}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Stethoscope className="h-5 w-5 text-primary" /> Medical Conditions
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Selecting conditions adjusts safe limits for sugar, sodium, and saturated fats.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { v: 'none', label: 'None' },
                { v: 'diabetes', label: 'Diabetes' },
                { v: 'hypertension', label: 'Hypertension' },
                { v: 'cholesterol', label: 'High Cholesterol' },
                { v: 'pcos', label: 'PCOS' },
              ].map((c) => (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => toggleMedical(c.v as any)}
                  className={`rounded-xl border-2 p-3 text-sm font-bold transition-all ${
                    form.medicalConditions.includes(c.v as any)
                      ? 'border-primary bg-primary/10 font-bold text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Allergies
            </h2>
            <div className="flex gap-2 mb-3">
              <Input
                value={allergyInput}
                onChange={(e) => setAllergyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAllergy(allergyInput))}
                placeholder="Type an allergy and press Enter"
                className="text-sm h-11"
              />
              <Button type="button" onClick={() => addAllergy(allergyInput)} className="h-11 px-4">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {COMMON_ALLERGIES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => addAllergy(a)}
                  className="rounded-full border border-dashed border-border px-3.5 py-1 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary transition"
                >
                  + {a}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {form.allergies.map((a) => (
                <Badge key={a} variant="secondary" className="gap-1 px-3 py-1 text-xs font-bold">
                  {a}
                  <button type="button" onClick={() => removeAllergy(a)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </Card>

          <div className="flex justify-end gap-3 pt-4 pb-8">
            <Button variant="outline" size="lg" onClick={handleCancel} disabled={saving} className="text-sm font-bold px-6">
              Cancel
            </Button>
            <Button size="lg" onClick={handleSave} disabled={saving} className="gap-2 text-sm font-bold px-6">
              <Check className="h-4 w-4" /> Save Profile to MongoDB
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl bg-background/90 p-4 text-center border border-border/60 shadow-xs">
      <div className="text-2xl sm:text-3xl font-extrabold text-primary">{value}</div>
      <div className="text-xs font-semibold text-muted-foreground mt-0.5">{unit}</div>
      <div className="text-xs font-bold mt-1 text-foreground">{label}</div>
    </div>
  );
}
