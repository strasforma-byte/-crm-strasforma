import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Mail, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#06b6d4", "#ec4899", "#6366f1"];

export default function AuthScreen() {
  const { state } = useApp();
  const [authMode, setAuthTab] = useState("login");
  const [loading, setLoading] = useState(false);
  
  // Login State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Register State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("commercial");
  const [newColor, setNewColor] = useState(COLORS[1]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Connexion réussie !");
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
      options: {
        data: {
          name: newName,
          role: newRole,
          color: newColor,
        }
      }
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Compte créé ! Veuillez vérifier votre email.");
      setAuthTab("login");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <div className="bg-green-600 text-white p-3 rounded-xl inline-block mb-4 shadow-lg shadow-green-200">
          <Shield className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">CRM Strasforma</h1>
        <p className="text-slate-500 mt-2">Gérez vos relations clients en toute simplicité</p>
      </div>

      <Card className="w-full max-w-md border-slate-200 shadow-xl">
        <CardContent className="pt-6">
          <Tabs value={authMode} onValueChange={setAuthTab}>
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="register">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email professionnel</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="nom@entreprise.fr" 
                      className="pl-10"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-10"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
                  {loading ? "Chargement..." : "Accéder à mon espace"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Prénom</Label>
                    <Input 
                      id="reg-name" 
                      placeholder="Thomas" 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-role">Rôle souhaité</Label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger id="reg-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="prospecteur">Prospecteur</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email professionnel</Label>
                  <Input 
                    id="reg-email" 
                    type="email" 
                    placeholder="thomas@entreprise.fr" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-password">Mot de passe</Label>
                  <Input 
                    id="reg-password" 
                    type="password" 
                    placeholder="Min. 6 caractères" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Couleur de votre profil</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-6 h-6 rounded-full transition-all ${newColor === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewColor(color)}
                      />
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 mt-4" disabled={loading}>
                  {loading ? "Création..." : "Créer mon compte"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
