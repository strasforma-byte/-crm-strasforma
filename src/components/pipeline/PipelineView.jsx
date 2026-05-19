import React, { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { usePermissions } from "@/hooks/usePermissions";
import { db } from "@/lib/db";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Lock, Globe, Settings2, MoreHorizontal } from "lucide-react";
import KanbanBoard from "./KanbanBoard";
import NewCardDialog from "./NewCardDialog";
import EditPipelineDialog from "./EditPipelineDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function PipelineView() {
  const { state, dispatch, isAdmin } = useApp();
  const { canViewPipeline, canEditPipeline } = usePermissions();

  const [activePipelineId, setActivePipelineId] = useState(state.pipelines[0]?.id || "");
  const [isNewPipelineOpen, setIsNewPipelineOpen] = useState(false);
  const [isEditPipelineOpen, setIsEditPipelineOpen] = useState(false);
  const [isNewCardOpen, setIsNewCardOpen] = useState(false);
  
  const [newPipeName, setNewPipeName] = useState("");
  const [newPipePublic, setNewPipePublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const visiblePipelines = useMemo(() => {
    return state.pipelines.filter(p => canViewPipeline(p));
  }, [state.pipelines, state.currentUser]);

  const activePipeline = useMemo(() => {
    return state.pipelines.find(p => p.id === activePipelineId) || visiblePipelines[0];
  }, [activePipelineId, state.pipelines, visiblePipelines]);

  const handleCreatePipeline = async () => {
    if (!newPipeName) {
      toast.error("Le nom du pipeline est requis");
      return;
    }
    
    setIsCreating(true);
    try {
      const newPipelineData = {
        name: newPipeName,
        ownerId: state.currentUser.id,
        visibility: newPipePublic ? "public" : "private",
        columns: [
          { name: "Nouveau Lead", order: 0 },
          { name: "Qualifié", order: 1 },
          { name: "Proposition", order: 2 },
          { name: "Gagné ✅", order: 3 },
        ]
      };

      const savedPipeline = await db.insertPipeline(newPipelineData);
      
      dispatch({ type: "UPDATE_PIPELINES", payload: [...state.pipelines, savedPipeline] });
      setActivePipelineId(savedPipeline.id);
      setIsNewPipelineOpen(false);
      setNewPipeName("");
      toast.success("Pipeline créé avec succès");
    } catch (error) {
      console.error("Error creating pipeline:", error);
      toast.error("Erreur lors de la création du pipeline");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-30">
        <div className="flex items-center gap-4">
          <Select value={activePipelineId || activePipeline?.id} onValueChange={setActivePipelineId}>
            <SelectTrigger className="w-[240px] font-bold text-lg border-none bg-transparent hover:bg-slate-50 focus:ring-0 px-2 h-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visiblePipelines.map(p => (
                <SelectItem key={p.id} value={p.id} className="font-medium">
                  {p.name} {p.ownerId === state.currentUser.id ? "(Moi)" : `(${state.users.find(u => u.id === p.ownerId)?.name})`}
                </SelectItem>
              ))}
              <div className="p-2 border-t mt-1">
                <Button variant="ghost" size="sm" className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => setIsNewPipelineOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau Pipeline
                </Button>
              </div>
            </SelectContent>
          </Select>

          {activePipeline && (
            <Badge variant="outline" className={`rounded-full flex items-center gap-1.5 px-3 py-1 ${activePipeline.visibility === 'public' ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-slate-600 bg-slate-50 border-slate-100'}`}>
              {activePipeline.visibility === "public" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {activePipeline.visibility === "public" ? "Public" : "Privé"}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex -space-x-2 mr-4 overflow-hidden">
            {state.users.slice(0, 4).map(u => (
              <Badge key={u.id} className="w-8 h-8 rounded-full border-2 border-white p-0 flex items-center justify-center text-[10px]" style={{ backgroundColor: u.color }}>
                {u.name.charAt(0)}
              </Badge>
            ))}
          </div>
          
          {activePipeline && canEditPipeline(activePipeline) && (
            <Button variant="outline" size="sm" className="hidden lg:flex" onClick={() => setIsEditPipelineOpen(true)}>
              <Settings2 className="w-4 h-4 mr-2" />
              Modifier Pipeline
            </Button>
          )}
          
          <Button onClick={() => setIsNewCardOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Affaire
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activePipeline ? (
          <KanbanBoard pipeline={activePipeline} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
            <KanbanSquare className="w-16 h-16 text-slate-200" />
            <p>Aucun pipeline sélectionné</p>
          </div>
        )}
      </div>

      <Dialog open={isNewPipelineOpen} onOpenChange={setIsNewPipelineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Nom du pipeline</Label>
              <Input placeholder="Ex: Ventes 2025" value={newPipeName} onChange={e => setNewPipeName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Visibilité publique</Label>
                <p className="text-xs text-slate-500">Tout le monde pourra voir ce pipeline</p>
              </div>
              <Switch checked={newPipePublic} onCheckedChange={setNewPipePublic} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewPipelineOpen(false)}>Annuler</Button>
            <Button className="bg-green-600" onClick={handleCreatePipeline} disabled={isCreating}>
              {isCreating ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditPipelineDialog 
        open={isEditPipelineOpen}
        onOpenChange={setIsEditPipelineOpen}
        pipeline={activePipeline}
      />

      <NewCardDialog 
        open={isNewCardOpen} 
        onOpenChange={setIsNewCardOpen} 
        defaultPipelineId={activePipeline?.id} 
      />
    </div>
  );
}

function KanbanSquare({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h4v4H7z"/><path d="M13 7h4v4h-4z"/><path d="M7 13h4v4H7z"/><path d="M13 13h4v4h-4z"/></svg>
  )
}
