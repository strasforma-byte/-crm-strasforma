import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Download, Trash2, RefreshCw, Shield } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#06b6d4", "#ec4899", "#6366f1"];

export default function SettingsDialog({ open, onOpenChange }) {
  const { state, dispatch, isAdmin, isCommercial } = useApp();
  const user = state.currentUser;

  const [name, setName] = useState(user?.name || "");
  const [color, setColor] = useState(user?.color || COLORS[0]);
  const [shareAgenda, setShareAgenda] = useState(user?.settings?.shareAgendaWithProspectors || false);
  const [calendarUrl, setCalendarUrl] = useState(user?.settings?.calendarUrl || "");
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (open && user) {
      setName(user.name || "");
      setColor(user.color || COLORS[0]);
      setShareAgenda(user.settings?.shareAgendaWithProspectors || false);
      setCalendarUrl(user.settings?.calendarUrl || "");
    }
  }, [open, user]);

  if (!user) return null;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    console.log("Saving settings for user:", user.id);
    
    try {
      const currentSettings = user.settings || {};
      const updatedProfile = {
        name,
        color,
        settings: { 
          ...currentSettings, 
          shareAgendaWithProspectors: shareAgenda,
          calendarUrl: calendarUrl
        }
      };

      console.log("Payload:", updatedProfile);
      const result = await db.updateUserProfile(user.id, updatedProfile);
      console.log("Update result:", result);
      
      const updatedUser = {
        ...user,
        ...updatedProfile
      };

      const updatedUsers = state.users.map(u => u.id === user.id ? updatedUser : u);
      dispatch({ type: "UPDATE_USERS", payload: updatedUsers });
      dispatch({ type: "SET_CURRENT_USER", payload: updatedUser });
      
      toast.success("Paramètres enregistrés");
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Erreur lors de l'enregistrement des paramètres : " + (error.message || "Erreur inconnue"));
    } finally {
      setIsSaving(false);
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

          <div className="space-y-3">
            <Label>Synchronisation Google Calendar</Label>
            <div className="grid grid-cols-1 gap-2">
              <div 
                className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('ical-upload').click()}
              >
                <input 
                  type="file" 
                  id="ical-upload" 
                  className="hidden" 
                  accept=".ics"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        const content = event.target.result;
                        dispatch({ type: "IMPORT_ICAL_DATA", payload: content });
                        toast.success("Calendrier Google importé avec succès !");
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 text-blue-500" />
                  <p className="text-xs font-bold text-slate-700">Cliquer pour importer votre fichier .ics</p>
                  <p className="text-[10px] text-slate-500 italic">
                    Paramètres Google Agenda &gt; Exporter l'agenda
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-600" />
                Sécurité & Données
              </Label>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Vos données sont stockées en temps réel sur Supabase (serveurs sécurisés). 
                Nous vous conseillons de télécharger une sauvegarde manuelle régulièrement.
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} className="text-xs font-bold border-green-100 hover:bg-green-50 text-green-700 h-10">
                <Download className="w-4 h-4 mr-2" />
                Télécharger une Sauvegarde Complète (JSON)
              </Button>
              
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-[10px] text-slate-400 hover:text-red-600 font-bold h-8">
                      <RefreshCw className="w-3 h-3 mr-2" />
                      Réinitialiser le cache local
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Réinitialiser le cache ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action ne supprimera pas vos données sur le serveur, mais forcera l'application à recharger toutes les informations.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReset} className="bg-red-600 text-white">Confirmer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button 
            onClick={handleSave} 
            className="bg-green-600 hover:bg-green-700 w-full"
            disabled={isSaving}
          >
            {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
