import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Download, Trash2, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#06b6d4", "#ec4899", "#6366f1"];

export default function SettingsDialog({ open, onOpenChange }) {
  const { state, dispatch, isAdmin, isCommercial } = useApp();
  const user = state.currentUser;

  const [name, setName] = useState(user?.name || "");
  const [color, setColor] = useState(user?.color || COLORS[0]);
  const [shareAgenda, setShareAgenda] = useState(user?.settings?.shareAgendaWithProspectors || false);

  if (!user) return null;

  const handleSave = async () => {
    try {
      const updatedProfile = {
        name,
        color,
        settings: { ...user.settings, shareAgendaWithProspectors: shareAgenda }
      };

      await db.updateUserProfile(user.id, updatedProfile);
      
      const updatedUser = {
        ...user,
        ...updatedProfile
      };

      const updatedUsers = state.users.map(u => u.id === user.id ? updatedUser : u);
      dispatch({ type: "UPDATE_USERS", payload: updatedUsers });
      dispatch({ type: "SET_CURRENT_USER", payload: updatedUser });
      
      onOpenChange(false);
      toast.success("Paramètres enregistrés");
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Erreur lors de l'enregistrement des paramètres");
    }
  };

  const handleExport = () => {
    const data = isAdmin ? state : { user, data: state };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-export-${user.name}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast.success("Données exportées");
  };

  const handleReset = () => {
    window.localStorage.removeItem("crm_data");
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Paramètres du profil</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Prénom</Label>
            <Input 
              id="settings-name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
            />
          </div>
          
          <div className="space-y-3">
            <Label>Couleur de l'avatar</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {isCommercial && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Partager mon agenda</Label>
                <p className="text-xs text-slate-500">Rendre visible aux Prospecteurs</p>
              </div>
              <Switch checked={shareAgenda} onCheckedChange={setShareAgenda} />
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <Label>Actions de données</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} className="text-xs">
                <Download className="w-3 h-3 mr-2" />
                Exporter JSON
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs text-red-600 hover:text-red-700">
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Réinitialiser
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action supprimera toutes les données locales et rechargera les données de démonstration.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset} className="bg-red-600">Réinitialiser</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 w-full">
            Enregistrer les modifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
